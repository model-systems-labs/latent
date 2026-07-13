import { materializeRecordedTraining } from "./materialize.js";
import type {
  MaterializedRecordedTraining,
  RecordedTrainingDocument,
  RecordedTrainingRegistration,
  TrainingArtifactRepository,
} from "./types.js";
import {
  assertRecordedTrainingCompatibility,
  assertRecordedTrainingDocument,
  snapshotRecordedTrainingDescriptors,
} from "./validation.js";

export class RecordedTrainingRegistry {
  private readonly registrations = new Map<string, RecordedTrainingRegistration>();
  private readonly scenarioByLesson = new Map<string, string>();
  private readonly recordings = new Map<string, Promise<RecordedTrainingDocument>>();

  register(registration: RecordedTrainingRegistration) {
    const descriptors = snapshotRecordedTrainingDescriptors(registration.scenario, registration.presentation);
    const { id, lessonId } = descriptors.scenario;
    if (this.registrations.has(id)) throw new Error(`Recorded training scenario already registered: ${id}.`);
    if (this.scenarioByLesson.has(lessonId)) throw new Error(`Lesson already has a recorded training scenario: ${lessonId}.`);
    this.registrations.set(id, { ...descriptors, loadRecording: registration.loadRecording });
    this.scenarioByLesson.set(lessonId, id);
    return this;
  }

  list() {
    return [...this.registrations.values()].map(({ scenario, presentation }) => ({ scenario, presentation }));
  }

  has(id: string) {
    return this.registrations.has(id);
  }

  scenarioIdForLesson(lessonId: string) {
    return this.scenarioByLesson.get(lessonId) ?? null;
  }

  invalidate(id?: string) {
    if (id) this.recordings.delete(id);
    else this.recordings.clear();
  }

  private recording(id: string, registration: RecordedTrainingRegistration) {
    const existing = this.recordings.get(id);
    if (existing) return existing;
    const loading = registration.loadRecording().then((value) => {
      const recording = assertRecordedTrainingDocument(value);
      assertRecordedTrainingCompatibility(recording, registration.scenario, registration.presentation);
      return recording;
    }).catch((error) => {
      this.recordings.delete(id);
      throw error;
    });
    this.recordings.set(id, loading);
    return loading;
  }

  async materialize(id: string, repository: TrainingArtifactRepository): Promise<MaterializedRecordedTraining> {
    const registration = this.registrations.get(id);
    if (!registration) throw new Error(`Unknown recorded training scenario: ${id}.`);
    const recording = await this.recording(id, registration);
    return materializeRecordedTraining({ ...registration, recording, repository });
  }

  async materializeForLesson(lessonId: string, repository: TrainingArtifactRepository) {
    const id = this.scenarioByLesson.get(lessonId);
    return id ? this.materialize(id, repository) : null;
  }
}
