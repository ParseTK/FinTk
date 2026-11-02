-- Runs once when the data volume is first created (see docker-compose.yml).
-- The test suite refuses to run against a database whose name does not end in _test.
CREATE DATABASE virello_test OWNER virello_app;
