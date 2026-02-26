import type { Agent, Message, Project } from '../../types';

export interface StreamingMessage {
  message_id: string;
  agent_id: string;
  agent_name: string;
  agent_avatar: string;
  content: string;
}

export interface ChatPanelProps {
  selectedAgent: Agent | null;
  messages: Message[];
  agents: Agent[];
  streamingMessage?: StreamingMessage | null;
  onSendMessage: (
    content: string,
    receiverType: 'agent' | 'department' | 'all',
    receiverId?: string,
    messageType?: string,
    projectMeta?: ProjectMetaPayload,
  ) => void | Promise<void>;
  onSendAnnouncement: (content: string) => void;
  onSendDirective: (
    content: string,
    projectMeta?: ProjectMetaPayload,
  ) => void;
  onClearMessages?: (agentId?: string) => void;
  onClose: () => void;
}

export type ChatMode = 'chat' | 'task' | 'announcement' | 'report';

export type ProjectMetaPayload = {
  project_id?: string;
  project_path?: string;
  project_context?: string;
};

export type PendingSendAction =
  | { kind: 'directive'; content: string }
  | { kind: 'announcement'; content: string }
  | { kind: 'task'; content: string; receiverId: string }
  | { kind: 'report'; content: string; receiverId: string }
  | { kind: 'chat'; content: string; receiverId: string }
  | { kind: 'broadcast'; content: string };

export type ProjectFlowStep = 'choose' | 'existing' | 'new' | 'confirm';

export interface ProjectFlowState {
  open: boolean;
  step: ProjectFlowStep;
  items: Project[];
  loading: boolean;
  selected: Project | null;
  existingInput: string;
  existingError: string;
  newName: string;
  newPath: string;
  newGoal: string;
  saving: boolean;
}
