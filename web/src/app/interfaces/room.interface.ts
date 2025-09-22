export interface RoomCreateResponse {
  roomId: string;
  customRoomId: string;
  agent: {
    participantId: string;
    token: string;
  };
  client: {
    participantId: string;
    token: string;
  };
}

export interface JoinConfig {
  roomId: string;
  token: string;
  participantId: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
}

export interface MediaState {
  hasMedia: boolean;
  error: string | null;
}
