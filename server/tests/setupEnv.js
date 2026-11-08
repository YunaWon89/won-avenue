// Tests always run against a separate database (it is dropped and re-seeded).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/food_delivery_test';
process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.DEEPL_API_KEY = '';
process.env.DEMO_MODE = 'true';
