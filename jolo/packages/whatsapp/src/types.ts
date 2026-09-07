export interface MetaReferral {
  source_id?: string;
  source_url?: string;
  source_type?: string;
  headline?: string;
  body?: string;
  media_type?: string;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  ctwa_clid?: string;
}

export interface NormalizedInboundMessage {
  wamid: string;
  from: string;
  waId: string;
  profileName?: string;
  type: string;
  text?: string;
  timestamp: Date;
  referral?: MetaReferral;
  raw: unknown;
}

export interface NormalizedStatus {
  wamid: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  recipientId?: string;
  errorCode?: string;
  errorMessage?: string;
  raw: unknown;
}

export interface NormalizedWebhook {
  phoneNumberId?: string;
  messages: NormalizedInboundMessage[];
  statuses: NormalizedStatus[];
}
