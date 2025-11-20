# Dangerous Schema Migration Guide

## ⚠️ Warning: Use at Your Own Risk

The `dangerouslyAddColumn()` and `dangerouslyMigrateSchema()` methods allow you to add columns to existing database tables **after initialization**. These are powerful features but come with significant risks.

## Why "Dangerous"?

These methods can cause:
- **Table locks** blocking all queries during migration
- **Downtime** on tables with many rows (>1,000)
- **Failed deployments** if schema changes are rolled back
- **Data inconsistencies** if migrations are interrupted

## When to Use

✅ **Safe scenarios:**
- Development/testing environments
- Small tables (<1,000 rows)
- During scheduled maintenance windows
- When you have a database backup

❌ **Avoid in:**
- Production without testing
- Peak traffic hours
- Large tables without maintenance window
- Without database backups

## Recommended Approach (Safe)

For **new installations**, always use `addField()` **before** `init()`:

```javascript
const auth = new SecureNodeAuth({ /* config */ });

// ✅ Add fields BEFORE init (safe)
auth.addField({ name: 'phoneNumber', type: 'VARCHAR(20)', unique: true });
auth.addField({ name: 'age', type: 'INTEGER', defaultValue: 0 });

await auth.init();  // Tables created with custom fields
```

## Dangerous Methods (Runtime Migration)

### 1. dangerouslyAddColumn()

Add a single column to an existing table.

```javascript
// Already initialized
await auth.init();

// Add column at runtime (⚠️ DANGEROUS)
await auth.dangerouslyAddColumn({
  name: 'phoneNumber',
  type: 'VARCHAR(20)',
  unique: true,
}, { 
  confirmed: true  // Required for safety
});
```

#### Options

```javascript
{
  confirmed: false,           // ❗ REQUIRED: Must be true to proceed
  skipIfExists: true,         // Skip if column exists (safe retry)
  skipIndexCreation: false,   // Skip index creation for performance
  warnThreshold: 1000,        // Warn if table has more rows
}
```

#### Field Configuration

```javascript
{
  name: 'columnName',         // Required: Column name (alphanumeric + underscore)
  type: 'VARCHAR(255)',       // Required: SQL data type
  unique: false,              // Optional: Add UNIQUE constraint
  required: false,            // Optional: Add NOT NULL constraint
  defaultValue: undefined,    // Optional: Default value for existing rows
}
```

#### Examples

**Add optional column:**
```javascript
await auth.dangerouslyAddColumn({
  name: 'phoneNumber',
  type: 'VARCHAR(20)',
}, { confirmed: true });
```

**Add required column with default:**
```javascript
await auth.dangerouslyAddColumn({
  name: 'accountType',
  type: 'VARCHAR(20)',
  required: true,
  defaultValue: 'free',  // ✅ Required for existing rows
}, { confirmed: true });
```

**Add unique column:**
```javascript
await auth.dangerouslyAddColumn({
  name: 'username',
  type: 'VARCHAR(50)',
  unique: true,
}, { confirmed: true });
```

### 2. dangerouslyMigrateSchema()

Add multiple columns in one operation.

```javascript
await auth.dangerouslyMigrateSchema([
  { name: 'phoneNumber', type: 'VARCHAR(20)', unique: true },
  { name: 'age', type: 'INTEGER', defaultValue: 0 },
  { name: 'city', type: 'VARCHAR(100)' },
  { name: 'isVerified', type: 'BOOLEAN', defaultValue: false },
], { 
  confirmed: true,
  useTransaction: true  // PostgreSQL: all-or-nothing
});
```

#### Options

```javascript
{
  confirmed: false,           // ❗ REQUIRED: Must be true
  useTransaction: true,       // Use transaction (PostgreSQL only)
  rollbackOnError: true,      // Rollback on failure (PostgreSQL only)
  skipIfExists: true,         // Skip existing columns
  skipIndexCreation: false,   // Skip index creation
  warnThreshold: 1000,        // Warn threshold for table size
}
```

#### Transaction Support

**PostgreSQL:** Supports transactions with automatic rollback
```javascript
// All-or-nothing: Either all columns are added or none
await auth.dangerouslyMigrateSchema(fields, {
  confirmed: true,
  useTransaction: true,  // ✅ Atomic operation
});
```

**MySQL:** No transaction support for ALTER TABLE
```javascript
// Sequential: Columns added one by one (no rollback)
await auth.dangerouslyMigrateSchema(fields, {
  confirmed: true,
  // Note: Cannot rollback on MySQL
});
```

## Best Practices

### 1. Always Backup First

```bash
# PostgreSQL
pg_dump -U postgres mydb > backup.sql

# MySQL
mysqldump -u root -p mydb > backup.sql
```

### 2. Test on Database Copy

```javascript
// Use separate test database
const auth = new SecureNodeAuth({
  connection: {
    database: 'myapp_test',  // ✅ Test database
    // ...
  }
});
```

### 3. Check Table Size

```javascript
const rowCount = await auth.db.getUserCount(auth.options.tables.users);
console.log(`Table has ${rowCount} rows`);

if (rowCount > 10000) {
  console.log('⚠️ Large table - schedule maintenance window');
}
```

### 4. Add Optional Columns First

```javascript
// Step 1: Add as optional (NULL allowed)
await auth.dangerouslyAddColumn({
  name: 'phoneNumber',
  type: 'VARCHAR(20)',
  required: false,  // ✅ Allow NULL initially
}, { confirmed: true });

// Step 2: Gradually backfill data
// (your application code)

// Step 3: Later, make it required (separate migration)
// ALTER TABLE users MODIFY phoneNumber VARCHAR(20) NOT NULL;
```

### 5. Use During Maintenance Windows

```javascript
// Check current time
const hour = new Date().getHours();
if (hour >= 2 && hour <= 4) {
  // 2-4 AM: Low traffic
  await auth.dangerouslyAddColumn(/* ... */);
} else {
  console.log('⚠️ Not in maintenance window. Aborting.');
}
```

## Error Handling

```javascript
try {
  await auth.dangerouslyAddColumn({
    name: 'phoneNumber',
    type: 'VARCHAR(20)',
  }, { confirmed: true });
  
  console.log('✅ Migration successful');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  
  // Check specific error types
  if (error.message.includes('already exists')) {
    console.log('Column already exists, safe to continue');
  } else if (error.message.includes('permission')) {
    console.log('Need ALTER TABLE permissions');
  } else {
    // Unknown error - investigate
    console.error('Stack:', error.stack);
  }
}
```

## Common Errors

### 1. Missing Confirmation

```javascript
// ❌ Error: Requires explicit confirmation
await auth.dangerouslyAddColumn({ name: 'field' });

// ✅ Fixed
await auth.dangerouslyAddColumn({ name: 'field' }, { confirmed: true });
```

### 2. Required Field Without Default

```javascript
// ❌ Error: Table has data, need default value
await auth.dangerouslyAddColumn({
  name: 'age',
  type: 'INTEGER',
  required: true,  // NOT NULL
  // Missing defaultValue!
}, { confirmed: true });

// ✅ Fixed
await auth.dangerouslyAddColumn({
  name: 'age',
  type: 'INTEGER',
  required: true,
  defaultValue: 0,  // ✅ Value for existing rows
}, { confirmed: true });
```

### 3. Reserved Field Names

```javascript
// ❌ Error: 'password' is reserved
await auth.dangerouslyAddColumn({
  name: 'password',
  type: 'VARCHAR(255)',
}, { confirmed: true });

// ✅ Use different name
await auth.dangerouslyAddColumn({
  name: 'passwordHash',
  type: 'VARCHAR(255)',
}, { confirmed: true });
```

### 4. Invalid Field Names

```javascript
// ❌ Error: Invalid characters
await auth.dangerouslyAddColumn({
  name: 'phone-number',  // Hyphen not allowed
}, { confirmed: true });

// ✅ Use underscore
await auth.dangerouslyAddColumn({
  name: 'phone_number',  // ✅ Valid
}, { confirmed: true });
```

## Data Types

### PostgreSQL

```javascript
'VARCHAR(n)'      // Variable-length string
'TEXT'            // Unlimited text
'INTEGER'         // 4-byte integer
'BIGINT'          // 8-byte integer
'DECIMAL(p,s)'    // Exact decimal
'BOOLEAN'         // True/False
'TIMESTAMP'       // Date and time
'JSON'            // JSON data
'JSONB'           // Binary JSON (indexed)
```

### MySQL

```javascript
'VARCHAR(n)'      // Variable-length string
'TEXT'            // Long text
'INT'             // Integer
'BIGINT'          // Big integer
'DECIMAL(p,s)'    // Exact decimal
'BOOLEAN'         // Alias for TINYINT(1)
'DATETIME'        // Date and time
'JSON'            // JSON data
'ENUM("a","b")'   // Enumeration
```

## Production Checklist

Before running dangerous migrations in production:

- [ ] Database backup created
- [ ] Tested on database copy
- [ ] Maintenance window scheduled
- [ ] Users notified about downtime
- [ ] Table size checked (<10,000 rows recommended)
- [ ] Server resources monitored
- [ ] Rollback plan prepared
- [ ] Team on standby for issues

## Getting Help

If you encounter issues:

1. Check the error message carefully
2. Review this guide for common errors
3. Test on a database copy
4. Check database logs for details
5. Open an issue on GitHub with details

## Safety First! 🛡️

Remember: The "dangerous" prefix is there for a reason. Always prefer the safe `addField()` method for new installations, and only use dangerous methods when absolutely necessary with proper precautions.
