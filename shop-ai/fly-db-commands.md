# Fly.io Database Debugging Commands

## Connect to Production Database

### Option 1: Direct psql Connection
```bash
fly postgres connect -a <your-postgres-app-name>
```

### Option 2: Proxy Connection (if you prefer)
```bash
# Start proxy in one terminal
fly proxy 5432 -a <your-postgres-app-name>

# Connect in another terminal
psql postgres://postgres:<password>@localhost:5432
```

## SQL Commands to Check Questions

### 1. Check if CustomerQuestion table exists
```sql
\dt public."CustomerQuestion"
```

### 2. Count total questions
```sql
SELECT COUNT(*) FROM public."CustomerQuestion";
```

### 3. Check questions by shop
```sql
SELECT 
    shop, 
    COUNT(*) as question_count,
    SUM(times) as total_asks,
    MAX("askedAt") as last_question
FROM public."CustomerQuestion" 
GROUP BY shop 
ORDER BY total_asks DESC;
```

### 4. View recent questions (last 50)
```sql
SELECT 
    shop,
    question,
    times,
    "askedAt"
FROM public."CustomerQuestion" 
ORDER BY "askedAt" DESC 
LIMIT 50;
```

### 5. Check specific shop questions
```sql
-- Replace 'your-shop.myshopify.com' with actual shop domain
SELECT * FROM public."CustomerQuestion" 
WHERE shop = 'your-shop.myshopify.com' 
ORDER BY times DESC;
```

### 6. Delete test data (if needed)
```sql
DELETE FROM public."CustomerQuestion" 
WHERE shop = 'test-shop.myshopify.com';
```

## Test Question Insertion via API

### 1. Test the API endpoint directly
```bash
# Replace with your actual app domain
curl -X POST https://your-app-name.fly.dev/apps/proxy/resource-openai \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are your shipping rates?",
    "productContext": "Test product context",
    "shop": "test-store.myshopify.com"
  }'
```

## Monitor Logs
```bash
# Watch real-time logs
fly logs -a <your-app-name>

# Filter for database-related logs
fly logs -a <your-app-name> | grep -i "database\|question\|upsert"
```

## Health Check
```bash
# Check database health endpoint
curl https://your-app-name.fly.dev/health/database
```