import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject } from 'rxjs';
import type { FlagChangedEvent } from '../delivery.types';
import { FLAG_CHANGED_EVENT } from '../delivery.types';

export interface SseEvent {
  data: string;
  type?: string;
  id?: string;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);

  /**
   * Map<environmentId, Set<Subject<SseEvent>>>
   * Cada conexión SSE activa tiene su propio Subject.
   * Cuando un flag cambia, se pushea a todos los subjects del ambiente.
   */
  private readonly connections = new Map<string, Set<Subject<SseEvent>>>();

  /**
   * Registra una nueva conexión SSE para un ambiente.
   * Devuelve el Subject que el controller convierte en Observable.
   */
  register(environmentId: string): Subject<SseEvent> {
    const subject = new Subject<SseEvent>();

    if (!this.connections.has(environmentId)) {
      this.connections.set(environmentId, new Set());
    }

    this.connections.get(environmentId)!.add(subject);
    this.logger.debug(
      `SSE connection registered for environment ${environmentId} ` +
      `(total: ${this.connections.get(environmentId)!.size})`,
    );

    return subject;
  }

  /**
   * Elimina una conexión SSE cuando el cliente desconecta.
   */
  unregister(environmentId: string, subject: Subject<SseEvent>): void {
    const set = this.connections.get(environmentId);
    if (!set) return;

    subject.complete();
    set.delete(subject);

    if (set.size === 0) {
      this.connections.delete(environmentId);
    }

    this.logger.debug(`SSE connection closed for environment ${environmentId}`);
  }

  /**
   * Notifica a todos los clientes SSE de un ambiente que los flags cambiaron.
   * Llamado automáticamente cuando se emite FLAG_CHANGED_EVENT.
   */
  @OnEvent(FLAG_CHANGED_EVENT)
  handleFlagChanged(event: FlagChangedEvent): void {
    const set = this.connections.get(event.environmentId);
    if (!set?.size) return;

    const sseEvent: SseEvent = {
      type: 'flags.changed',
      data: JSON.stringify({
        environmentId: event.environmentId,
        flagKey: event.flagKey ?? null,
        timestamp: Date.now(),
      }),
    };

    for (const subject of set) {
      subject.next(sseEvent);
    }

    this.logger.debug(
      `SSE event pushed to ${set.size} connection(s) for environment ${event.environmentId}`,
    );
  }

  /** Número total de conexiones SSE activas — útil para métricas */
  getConnectionCount(): number {
    let total = 0;
    for (const set of this.connections.values()) {
      total += set.size;
    }
    return total;
  }
}
