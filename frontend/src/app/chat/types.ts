export type Attachment = {
  name: string;
  url: string;
  type: string;
  size: number;
};

export type Message = {
  role: "user" | "bot";
  content: string;
  timestamp: number;
  attachment?: Attachment;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};
