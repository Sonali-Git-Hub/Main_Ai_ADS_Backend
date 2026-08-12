const fs = require('fs');
const path = require('path');

class ProjectStorageService {
  constructor() {
    this.baseStorageDir = path.join(__dirname, '../../../../storage/projects');
    if (!fs.existsSync(this.baseStorageDir)) {
      fs.mkdirSync(this.baseStorageDir, { recursive: true });
    }
  }

  getProjectVersionPath(projectId, version = 'v1') {
    return path.join(this.baseStorageDir, projectId, version);
  }

  saveVersionArtifacts(projectId, version, filesMap = {}) {
    const versionDir = this.getProjectVersionPath(projectId, version);
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }

    let count = 0;
    for (const [relPath, content] of Object.entries(filesMap)) {
      const fullPath = path.join(versionDir, relPath);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
      count++;
    }

    return { success: true, versionDir, fileCount: count };
  }

  loadVersionArtifacts(projectId, version = 'v1') {
    const versionDir = this.getProjectVersionPath(projectId, version);
    if (!fs.existsSync(versionDir)) {
      return { success: false, error: 'Version files not found on disk', files: {} };
    }

    const files = {};
    const readDirectoryRecursively = (currentDir, relPrefix = '') => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          readDirectoryRecursively(fullPath, relPath);
        } else if (entry.isFile()) {
          files[relPath] = fs.readFileSync(fullPath, 'utf8');
        }
      }
    };

    readDirectoryRecursively(versionDir);
    return { success: true, files };
  }
}

module.exports = new ProjectStorageService();
