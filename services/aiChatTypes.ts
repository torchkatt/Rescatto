import { Product, Venue, User, Order } from '../types';

// ─── Message Types ───

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallResponse {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

// ─── Tool Definitions (OpenAI-compatible for DeepSeek) ───

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ─── Tool Results ───

export interface VenueSearchResult {
  id: string;
  name: string;
  address: string;
  city?: string;
  businessType?: string;
  categories?: string[];
  isOpen: boolean;
  closingTime?: string;
  rating: number;
  productCount: number;
  distance?: string;
}

export interface ProductSearchResult {
  id: string;
  name: string;
  venueId: string;
  venueName: string;
  originalPrice: number;
  discountedPrice: number;
  dynamicDiscountedPrice?: number;
  quantity: number;
  availableUntil: string;
  type: string;
  imageUrl?: string;
  discountPct: number;
}

export interface OrderSearchResult {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  venueName?: string;
  products: { name: string; quantity: number }[];
}

// ─── Message Limits ───

export type AIChatPlanTier = 'free' | 'pass_monthly' | 'pass_annual' | 'admin' | 'guest';

export interface AIChatPlan {
  tier: AIChatPlanTier;
  dailyLimit: number;
  label: string;
}

export const AI_CHAT_PLANS: Record<AIChatPlanTier, AIChatPlan> = {
  guest: { tier: 'guest', dailyLimit: 5, label: 'Invitado' },
  free: { tier: 'free', dailyLimit: 20, label: 'Gratuito' },
  pass_monthly: { tier: 'pass_monthly', dailyLimit: 100, label: 'Rescatto Pass Mensual' },
  pass_annual: { tier: 'pass_annual', dailyLimit: Infinity, label: 'Rescatto Pass Anual' },
  admin: { tier: 'admin', dailyLimit: Infinity, label: 'Administrador' },
};

export interface AIChatUsage {
  messagesToday: number;
  lastMessageDate: string; // YYYY-MM-DD
  totalMessages: number;
  tier: AIChatPlanTier;
}
