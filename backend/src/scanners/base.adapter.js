/**
 * BaseScannerAdapter: Abstract base class for scanner plugins (Semgrep, Bandit, Trivy, etc.)
 */
class BaseScannerAdapter {
  constructor(name) {
    if (new.target === BaseScannerAdapter) {
      throw new TypeError("Cannot construct BaseScannerAdapter instances directly");
    }
    this.name = name;
  }

  /**
   * Check if scanner binary/tool is available on host system
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error("Method 'isAvailable()' must be implemented.");
  }

  /**
   * Execute scanner against ephemeral workspace directory
   * @param {string} workspacePath - Absolute path to extracted repository code
   * @returns {Promise<Array<Object>>} Array of raw scanner finding objects
   */
  async scan(workspacePath) {
    throw new Error("Method 'scan()' must be implemented.");
  }
}

module.exports = BaseScannerAdapter;
