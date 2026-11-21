/**
 * El canal que no espera: un canal de datos WebRTC sin reenvíos ni orden, al lado del WebSocket.
 *
 * Por el WebSocket (TCP), si se pierde un paquete en la red móvil, todo lo que viene detrás espera
 * a que se reenvíe: 200 ms a más de un segundo sin estados. Por este canal (UDP), un paquete
 * perdido se olvida y se usa el siguiente. El WebSocket sigue para todo lo demás y como respaldo:
 * si el canal no abre (una red que bloquea UDP) o deja de andar, los estados vuelven a él solos.
 *
 * La oferta va por el WebSocket (`rtcOffer`) y el celular contesta (`rtcAnswer`). No hace falta
 * STUN: la Sala tiene IP pública y la anuncia ella misma. Los puertos UDP (`SALA_RTC_PUERTOS`,
 * 40000-40199) deben estar abiertos en el firewall de Google Cloud: ver docs/servidor-santiago.md.
 */
import { type RTCDataChannel, RTCPeerConnection } from 'werift';
import type { FastLink, Peer } from '../src/roomHost';

/** `SALA_RTC=0` apaga el canal (todo por WebSocket, como antes). */
export const RTC_ENABLED = process.env.SALA_RTC !== '0';
const PORTS = (process.env.SALA_RTC_PUERTOS ?? '40000-40199').split('-').map(Number) as [
  number,
  number,
];
/** Solo para pruebas: qué parte de los estados por el canal se pierde a propósito (0 a 1). */
const TEST_LOSS = Number(process.env.SALA_RTC_PERDIDA ?? 0);
/** Si el canal no abre en este rato, se deja (sigue el WebSocket). */
const OPEN_TIMEOUT_MS = 8000;
/** Más que esto esperando salir y el estado se descarta: uno nuevo llega en 33 ms. */
const MAX_BUFFERED = 32 * 1024;

/**
 * La IP pública de la máquina, para anunciarla en la oferta. En Google Cloud la máquina solo ve su
 * IP interna; la pública se pide a los metadatos. `SALA_IP` la fija a mano (pruebas).
 */
let publicIp: Promise<string | null> | null = null;

function publicAddress(): Promise<string | null> {
  publicIp ??= (async () => {
    if (process.env.SALA_IP !== undefined) return process.env.SALA_IP || null;
    try {
      const response = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip',
        { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(2000) },
      );
      return response.ok ? (await response.text()).trim() || null : null;
    } catch {
      return null;
    }
  })();
  return publicIp;
}

/** Lo que necesita la conexión rápida de su Sala. */
export interface FastHandlers {
  opened(): void;
  message(data: string | Uint8Array): void;
}

/** El canal de un celular: se arma con la oferta y vive lo que viva su WebSocket. */
export class RtcLink implements FastLink {
  private readonly pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private closed = false;
  private readonly timeout: ReturnType<typeof setTimeout>;

  private constructor(
    pc: RTCPeerConnection,
    private readonly peer: Peer,
  ) {
    this.pc = pc;
    this.timeout = setTimeout(() => {
      if (!this.open) this.close();
    }, OPEN_TIMEOUT_MS);
    this.timeout.unref?.();
  }

  /** Arma la conexión y devuelve la oferta para mandarle al celular (null si no se pudo). */
  static async offer(
    peer: Peer,
    handlers: FastHandlers,
  ): Promise<{ link: RtcLink; sdp: string } | null> {
    const ip = await publicAddress();
    const pc = new RTCPeerConnection({
      iceServers: [],
      icePortRange: PORTS,
      iceAdditionalHostAddresses: ip ? [ip] : undefined,
      iceUseIpv6: false,
    });
    const link = new RtcLink(pc, peer);
    try {
      const channel = pc.createDataChannel('estados', { ordered: false, maxRetransmits: 0 });
      channel.onopen = () => {
        if (link.closed) return;
        link.channel = channel;
        peer.fast = link;
        handlers.opened();
      };
      channel.onclose = () => link.close();
      channel.onMessage.subscribe((data) => {
        if (link.closed) return;
        handlers.message(typeof data === 'string' ? data : new Uint8Array(data));
      });
      pc.connectionStateChange.subscribe((state) => {
        if (state === 'failed' || state === 'closed') link.close();
      });
      await pc.setLocalDescription(await pc.createOffer());
      // Se espera a tener todos los candidatos: así va una sola oferta, sin ir y venir.
      const started = Date.now();
      while (pc.iceGatheringState !== 'complete' && Date.now() - started < 3000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const sdp = pc.localDescription?.sdp;
      if (!sdp || link.closed) {
        link.close();
        return null;
      }
      return { link, sdp };
    } catch (error) {
      link.close();
      throw error;
    }
  }

  get open(): boolean {
    return !this.closed && this.channel?.readyState === 'open';
  }

  async answer(sdp: string): Promise<void> {
    if (this.closed) return;
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  send(data: Uint8Array): void {
    const channel = this.channel;
    if (!channel || !this.open) return;
    // Si la red no da abasto, mejor saltarse un estado que atrasar todos.
    if (channel.bufferedAmount > MAX_BUFFERED) return;
    if (TEST_LOSS > 0 && Math.random() < TEST_LOSS) return;
    channel.send(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timeout);
    if (this.peer.fast === this) this.peer.fast = undefined;
    this.pc.close().catch(() => {});
  }
}
