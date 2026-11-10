-- Canary: a table that exists before the batch, a column added and used in the same batch.
CREATE TABLE canary_t (id int NOT NULL);
GO

BEGIN TRANSACTION;
ALTER TABLE canary_t ADD new_col int NULL;
UPDATE canary_t SET new_col = 1;
COMMIT;
GO
