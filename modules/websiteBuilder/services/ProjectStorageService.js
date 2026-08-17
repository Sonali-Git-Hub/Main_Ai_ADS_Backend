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
          if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
          readDirectoryRecursively(fullPath, relPath);
        } else if (entry.isFile()) {
          if (entry.name === '.DS_Store' || entry.name.endsWith('.log')) continue;
          try {
            files[relPath] = fs.readFileSync(fullPath, 'utf8');
          } catch (e) {
            // Ignore binary read errors if any
          }
        }
      }
    };

    readDirectoryRecursively(versionDir);
    return { success: true, files };
  }

  exportProjectZip(projectId, version = 'v1', res, downloadName = 'website-source-code') {
    const versionDir = this.getProjectVersionPath(projectId, version);
    if (!fs.existsSync(versionDir)) {
      return res.status(404).json({ success: false, error: 'Project version files not found on disk' });
    }

    const archiver = require('archiver');
    const safeName = downloadName.toLowerCase().replace(/[^a-z0-9-_]/g, '-') || 'website-app';

    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}-source-code.zip"`);
    }

    const archive = typeof archiver === 'function'
      ? archiver('zip', { zlib: { level: 9 } })
      : (archiver.ZipArchive ? new archiver.ZipArchive({ zlib: { level: 9 } }) : archiver.create('zip', { zlib: { level: 9 } }));

    archive.on('error', (err) => {
      console.error('[ExportZIP Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    archive.pipe(res);

    // Append files from versionDir, ignoring node_modules, dist, .git
    archive.glob('**/*', {
      cwd: versionDir,
      ignore: ['node_modules/**', 'dist/**', '.git/**', '*.log', '.DS_Store'],
      dot: true
    });

    archive.finalize();
  }
}

module.exports = new ProjectStorageService();
