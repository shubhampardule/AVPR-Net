import React, { useState } from 'react';
import { GitBranch, Wrench, ShieldCheck, Check, Sparkles } from 'lucide-react';
import { DiffViewer } from '../ui/DiffViewer';

export function StageRemediate() {
  const [activeTab, setActiveTab] = useState('sql'); // 'sql' | 'command'

  const sqlScenario = {
    filename: 'src/routes/login.js',
    branch: 'securepatch/fix-VUL-NODE-089',
    vulnerableCode: `// db query in authentication controller
const username = req.body.username;
const query = "SELECT * FROM users WHERE id=" + userId;
db.query(query);`,
    remediatedCode: `// Parameterized query isolates data from execution context
const username = req.body.username;
const query = "SELECT * FROM users WHERE id = ?";
db.query(query, [userId]);`,
    unifiedDiff: `--- a/src/routes/login.js
+++ b/src/routes/login.js
@@ -124,3 +124,3 @@
-const query = "SELECT * FROM users WHERE id=" + userId;
-db.query(query);
+const query = "SELECT * FROM users WHERE id = ?";
+db.query(query, [userId]);`,
    explanation: 'Parameterized queries ensure the SQL driver treats all user variables strictly as data literals, preventing injection.',
    strategy: 'Parameterized Query (Rule-Based Fix)'
  };

  const cmdScenario = {
    filename: 'services/transcoder.py',
    branch: 'securepatch/fix-VUL-PY-078',
    vulnerableCode: `# Direct shell execution vulnerable to metacharacters
cmd = f"ffmpeg -i {filename} -vcodec {target_codec} output.mp4"
subprocess.call(cmd, shell=True)`,
    remediatedCode: `# Isolated argument vector without shell execution
safe_cmd = ["ffmpeg", "-i", filename, "-vcodec", target_codec, "output.mp4"]
subprocess.run(safe_cmd, shell=False, check=True)`,
    unifiedDiff: `--- a/services/transcoder.py
+++ b/services/transcoder.py
@@ -65,2 +65,2 @@
-cmd = f"ffmpeg -i {filename} -vcodec {target_codec} output.mp4"
-subprocess.call(cmd, shell=True)
+safe_cmd = ["ffmpeg", "-i", filename, "-vcodec", target_codec, "output.mp4"]
+subprocess.run(safe_cmd, shell=False, check=True)`,
    explanation: 'Executing directly with shell=False and an argument vector bypasses /bin/sh command interpretation.',
    strategy: 'Subprocess Argument List Isolation'
  };

  const current = activeTab === 'sql' ? sqlScenario : cmdScenario;

  return (
    <div className="space-y-4 text-left">
      {/* Selector Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'sql'
                ? 'bg-white/10 text-white border border-white/20'
                : 'bg-[#111419] text-text-muted hover:text-text-primary border border-white/[0.06]'
            }`}
          >
            CWE-89: Node.js SQL Injection
          </button>
          <button
            onClick={() => setActiveTab('command')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === 'command'
                ? 'bg-white/10 text-white border border-white/20'
                : 'bg-[#111419] text-text-muted hover:text-text-primary border border-white/[0.06]'
            }`}
          >
            CWE-78: Python Command Injection
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-text-muted">
          <Sparkles className="w-3.5 h-3.5 text-[#60A5FA]" />
          <span>Rule-Based & Context-Aware Patching</span>
        </div>
      </div>

      <DiffViewer
        filename={current.filename}
        branch={current.branch}
        vulnerableCode={current.vulnerableCode}
        remediatedCode={current.remediatedCode}
        unifiedDiff={current.unifiedDiff}
        explanation={current.explanation}
        strategy={current.strategy}
      />
    </div>
  );
}
