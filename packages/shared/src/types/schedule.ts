export interface ScheduleBlock {
  id: string
  userId: string
  locationId: string
  locationName: string
  dayOfWeek: number
  startTime: string
  endTime: string
  slotDurationMin: number
  createdAt: string
}

export interface ScheduleException {
  id: string
  userId: string
  locationId: string
  locationName: string
  date: string
  type: 'blocked' | 'available'
  startTime: string | null
  endTime: string | null
  reason: string | null
  createdAt: string
}
