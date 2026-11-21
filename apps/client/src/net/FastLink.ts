/**
 * El canal que no espera, del lado del celular: un canal de datos WebRTC sin reenvíos ni orden.
 *
 * Por el WebSocket, si la red móvil pierde un paquete, todo lo que viene detrás espera a que se
 * reenvíe (silencios de 200 ms a más de un segundo). Por aquí, un estado perdido se olvida y se usa
 * el siguiente. La Sala lo ofrece (`rtcOffer`) por el WebSocket; si no abre o deja de andar, todo
 * sigue por el WebSocket sin que el jugador note nada.
 */
import { DatagramStateDecoder, encodeDatagramAck, type MissedEvents } from '@crisol/protocol';

/** Lo que le llega al juego desde el canal. */
export interface FastLinkHandlers {
  /**
   * Un estado (ya armado), con los eventos de los que se perdieron por el camino. Puede llegar
   * desordenado: el juego decide qué mostrar.
   */
  frame(frame: unknown, missed: readonly MissedEvents[], bytes: number): void;
  opened(): void;
}

/** Si este navegador sabe abrir el canal. */
export function fastLinkSupported(): boolean {
  return typeof RTCPeerConnection === 'function';
}

export class FastLink {
  private readonly pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private readonly decoder = new DatagramStateDecoder();
  private closed = false;
  /** Cuándo se pidió (para saber cuánto tardó en abrir). */
  readonly startedAt = performance.now();
  openedAt = 0;

  constructor(private readonly handlers: FastLinkHandlers) {
    // Sin STUN: la Sala tiene IP pública y la anuncia; el celular llega a ella desde su red.
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.pc.addEventListener('datachannel', (event) => this.use(event.channel));
    this.pc.addEventListener('connectionstatechange', () => {
      const state = this.pc.connectionState;
      if (state === 'failed' || state === 'closed') this.close();
    });
  }

  get open(): boolean {
    return !this.closed && this.channel?.readyState === 'open';
  }

  /** Contesta la oferta de la Sala: devuelve la respuesta para mandarle por el WebSocket. */
  async answer(offer: string): Promise<string | null> {
    await this.pc.setRemoteDescription({ type: 'offer', sdp: offer });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    // Se espera a tener los candidatos propios (un instante): va una sola respuesta.
    await new Promise<void>((resolve) => {
      if (this.pc.iceGatheringState === 'complete') return resolve();
      const done = (): void => {
        if (this.pc.iceGatheringState !== 'complete') return;
        this.pc.removeEventListener('icegatheringstatechange', done);
        resolve();
      };
      this.pc.addEventListener('icegatheringstatechange', done);
      setTimeout(resolve, 1500);
    });
    if (this.closed) return null;
    return this.pc.localDescription?.sdp ?? null;
  }

  /** Manda algo chico (los últimos toques) por el canal, si está abierto. */
  send(data: string): void {
    if (!this.open) return;
    try {
      this.channel?.send(data);
    } catch {
      // Se está cerrando: el WebSocket lleva lo mismo.
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.channel = null;
    try {
      this.pc.close();
    } catch {
      // Ya estaba cerrado.
    }
  }

  private use(channel: RTCDataChannel): void {
    channel.binaryType = 'arraybuffer';
    channel.addEventListener('open', () => {
      if (this.closed) return;
      this.channel = channel;
      this.openedAt = performance.now();
      this.handlers.opened();
    });
    channel.addEventListener('close', () => this.close());
    channel.addEventListener('message', (event) => {
      if (this.closed || !(event.data instanceof ArrayBuffer)) return;
      const data = new Uint8Array(event.data);
      let got: ReturnType<DatagramStateDecoder['decode']>;
      try {
        got = this.decoder.decode(data);
      } catch {
        // Uno ilegible se ignora: el próximo viene sobre una base confirmada.
        return;
      }
      if (!got) return;
      // Se confirma al tiro: desde ahora la Sala manda la diferencia con este.
      try {
        channel.send(encodeDatagramAck(got.seq) as Uint8Array<ArrayBuffer>);
      } catch {
        // Se está cerrando.
      }
      this.handlers.frame(got.frame, got.missed, data.byteLength);
    });
  }
}
