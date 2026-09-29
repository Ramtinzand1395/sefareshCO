export type MongoUpdateMatch = {
  matchedCount: number;
  modifiedCount: number;
};

export function matchedExistingDocument(result: MongoUpdateMatch) {
  return result.matchedCount > 0;
}
