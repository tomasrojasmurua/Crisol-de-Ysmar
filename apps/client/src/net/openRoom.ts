import type { Controller } from '@crisol/core';
import type { PlayerInfo } from '@crisol/protocol';
import type { Diagnostics } from '../game/Diagnostics';
import type { Hud } from '../ui/Hud';
import type { Lobby } from '../ui/Lobby';
import { leftRoom, rememberRoom } from './lastRoom';
import { NetMatch, type NetProfile } from './NetMatch';

export interface RoomDeps {
  readonly lobby: Lobby;
  readonly hud: Hud;
  readonly diagnostics: Diagnostics;
  readonly human: Controller;
  /** La sala en curso: los avisos de una sala vieja (ya cerrada) se ignoran. */
  readonly current: () => NetMatch | null;
  /** Si ya hay una partida a la vista (si no, los problemas se muestran en la sala). */
  readonly playing: () => boolean;
  /** Empezó una partida en la sala (la primera o una revancha). */
  readonly onStart: (match: NetMatch) => void;
}

/**
 * Entra a una sala y conecta lo que llega con la pantalla: la lista de la sala de espera, los
 * avisos de quien se fue o volvió, los problemas de conexión y los datos de la red.
 */
export function openRoom(code: string, profile: NetProfile, deps: RoomDeps): NetMatch {
  const { lobby, hud, diagnostics } = deps;
  /** Quién estaba presente la última vez, para avisar cuando alguien se va o vuelve. */
  const seen = new Map<number, boolean>();
  /** Puestos de la IA: si un amigo llega tarde y toma uno, se avisa que entró (no que volvió). */
  const bots = new Set<number>();
  // Presente: conectado y con la app a la vista. Si no, la IA juega por él.
  const present = (p: PlayerInfo): boolean => p.connected && !p.away;
  rememberRoom(code);
  const room: NetMatch = new NetMatch(code, profile, deps.human, {
    players: (players, me) => {
      lobby.setPlayers(players, me, room.settings, room.hostId);
      if (room !== deps.current()) return;
      if (room.started) {
        // Avisos de quien se fue o volvió durante la partida.
        for (const p of players) {
          if (p.id === me) continue;
          const was = seen.get(p.id);
          if (was === true && !present(p)) {
            // Conectado pero ausente: salió de la app o se quedó sin señal (la Sala no distingue).
            const why = p.connected ? 'se fue un momento' : 'se desconectó';
            hud.announce(`${p.name} ${why}`, 'La IA juega por él', 2.6);
          }
          if (was === false && present(p)) {
            hud.announce(
              bots.has(p.id) ? `${p.name} entró a la partida` : `${p.name} volvió`,
              '',
              2,
            );
          }
        }
      }
      for (const p of players) {
        seen.set(p.id, present(p));
        if (p.bot) bots.add(p.id);
        else if (present(p)) bots.delete(p.id);
      }
    },
    start: (started) => {
      if (started === deps.current()) deps.onStart(started);
    },
    problem: (reason, fatal) => {
      if (room !== deps.current()) return;
      if (fatal) leftRoom();
      if (lobby.visible) lobby.setStatus(reason);
      else hud.announce(reason, fatal ? '' : 'Tu mago sigue en manos de la IA', 3);
      if (fatal && !deps.playing()) lobby.setStatus(reason);
    },
    notice: (text) => {
      if (room !== deps.current()) return;
      if (!lobby.visible) hud.announce(text, '', 1.6);
    },
    stats: (stats) => {
      // Sigues en la sala: si la página se cierra sin querer, se vuelve sola.
      if (room === deps.current()) rememberRoom(code);
      const simulated = stats.simulated ? ` · ${stats.simulated}` : '';
      diagnostics.netStats(
        `${stats.ping} ms · colchón ${stats.buffer}/${stats.target} · cortes ${stats.stalls} · ${stats.kbps} kB/s · máx ${stats.biggest} B${simulated}`,
      );
    },
  });
  return room;
}
