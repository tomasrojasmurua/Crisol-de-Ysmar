export { decodeClientMessage, decodeServerMessage, encode } from './codec';
export {
  type ClientMessage,
  isValidRoomCode,
  PROTOCOL_VERSION,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type ServerMessage,
} from './messages';
