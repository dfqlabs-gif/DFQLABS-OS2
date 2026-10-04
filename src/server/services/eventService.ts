import { ActivityEvent } from "../../shared/types/index.js";
import { getSupabaseClient } from "../config/supabase.js";

const eventStore: ActivityEvent[] = [];

export class EventService {
  public static logEvent(event: Omit<ActivityEvent, "id" | "createdAt">): ActivityEvent {
    const newEvent: ActivityEvent = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    eventStore.push(newEvent);
    const db = getSupabaseClient();
    if (db) {
      void db.from("activities_events").insert({ id: newEvent.id, event_type: newEvent.eventType, lead_id: newEvent.leadId, actor_user_id: newEvent.actorUserId, payload: newEvent.payload, created_at: newEvent.createdAt });
    }
    return newEvent;
  }

  public static getEventsForLead(leadId: string): ActivityEvent[] {
    return eventStore.filter((e) => e.leadId === leadId);
  }

  public static getAllEvents(): ActivityEvent[] {
    return [...eventStore];
  }
}
