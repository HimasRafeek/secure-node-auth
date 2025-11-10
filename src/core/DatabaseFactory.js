const DatabaseManager = require('./DatabaseManager');
const PostgresDatabaseManager = require('./PostgresDatabaseManager');

/**
 * DatabaseFactory - Creates the appropriate database manager based on configuration
 */
class DatabaseFactory {
  /**
   * Create database manager instance
   * @param {Object} config - Database configuration
   * @param {string} config.type - Database type: 'mysql' or 'postgres' (default: 'mysql')
   * @returns {DatabaseManager|PostgresDatabaseManager}
   */
  static create(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Database configuration is required');
    }

    const dbType = (config.type || 'mysql').toLowerCase();

    switch (dbType) {
      case 'mysql':
        return new DatabaseManager(config);

      case 'postgres':
      case 'postgresql':
      case 'pg':
        return new PostgresDatabaseManager(config);

      default:
        throw new Error(
          `Unsupported database type: ${dbType}. Supported types: 'mysql', 'postgres'`
        );
    }
  }

  /**
   * Get list of supported database types
   * @returns {string[]}
   */
  static getSupportedTypes() {
    return ['mysql', 'postgres'];
  }
}

module.exports = DatabaseFactory;
