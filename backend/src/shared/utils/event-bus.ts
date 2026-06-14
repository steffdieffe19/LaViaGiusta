import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();

export const EVENTS = {
  HIKE_UPDATE: 'hike_update',
};
