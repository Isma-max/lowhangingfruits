import { DoblajeJob } from './types'

const jobs = new Map<string, DoblajeJob>()

export function getJob(id: string): DoblajeJob | undefined {
  return jobs.get(id)
}

export function setJob(id: string, job: DoblajeJob) {
  jobs.set(id, job)
}

export function updateJob(id: string, patch: Partial<DoblajeJob>) {
  const existing = jobs.get(id)
  if (existing) jobs.set(id, { ...existing, ...patch })
}
