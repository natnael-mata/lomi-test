-- Question.fieldId must equal its topic's real field.
--
-- Hand-written: a trigger cannot be expressed in schema.prisma and will not
-- appear in `migrate diff` output. Review future generated migrations for a DROP
-- of this trigger or function.
--
-- `fieldId` is denormalised from topic → course → field so the question-serving
-- hot path is one index instead of a three-table join (see the schema comment on
-- the column). The cost of that is drift, and a drifted row does not look
-- broken: it serves a student a question from another programme entirely, with
-- no error anywhere. So the database checks it rather than every present and
-- future write path being trusted to.
--
-- It RAISES rather than silently correcting. A write that disagrees with the
-- taxonomy is a bug in the caller, and quietly rewriting the value would hide
-- it — including the case this exists for, moving a question to a topic in
-- another field and forgetting to update `fieldId`.

CREATE OR REPLACE FUNCTION question_field_matches_topic()
RETURNS TRIGGER AS $$
DECLARE
  real_field_id TEXT;
BEGIN
  SELECT c."fieldId"
    INTO real_field_id
    FROM "Topic" t
    JOIN "Course" c ON c."id" = t."courseId"
   WHERE t."id" = NEW."topicId";

  IF real_field_id IS NULL THEN
    -- The FK will refuse this too; raising here gives the better message.
    RAISE EXCEPTION
      'Question %: topic % does not exist', COALESCE(NEW."stableId", NEW."id"), NEW."topicId";
  END IF;

  IF NEW."fieldId" IS DISTINCT FROM real_field_id THEN
    RAISE EXCEPTION
      'Question %: fieldId % does not match its topic''s field % — a question must belong to the programme its topic sits in',
      COALESCE(NEW."stableId", NEW."id"), NEW."fieldId", real_field_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BEFORE, not AFTER: the row must never exist in a drifted state, not even
-- inside the transaction that would go on to read it.
CREATE TRIGGER question_field_matches_topic_trg
  BEFORE INSERT OR UPDATE OF "topicId", "fieldId" ON "Question"
  FOR EACH ROW
  EXECUTE FUNCTION question_field_matches_topic();
