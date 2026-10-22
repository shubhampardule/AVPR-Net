import React, { useState } from 'react';
import { GitBranch, FileCode2, ArrowUpRight, CircleDot, ChevronRight } from 'lucide-react';

const findings = [
  { title: 'Missing authorization check', path: 'src/api/accounts.js', line: 84, severity: 'High', rule: 'Access control', risk: 'A signed-in user could read another account’s data. The route returns the record without checking who owns it.', code: ['const account = await findById(id);', 'res.json(account);'], next: 'Check that the signed-in user owns this account before returning the record.' },
  { title: 'Insecure cookie settings', path: 'src/http/session.js', line: 29, severity: 'Medium', rule: 'Session security', risk: 'The session cookie is available to client-side scripts. An injected script could read it and use the session.', code: ['res.cookie("session", token, {', '  httpOnly: false', '});'], next: 'Enable httpOnly and secure cookie flags. Review SameSite behavior for your authentication flow.' },
];

export function RepositoryPreview() {
  const [selected, setSelected] = useState(0);
  const finding = findings[selected];
  return (
    <section aria-label="Sample repository overview" className="review-dossier">
      <div className="review-dossier-top"><span><FileCode2 size={15} aria-hidden="true" /> acme / payments-api <ChevronRight size={13} aria-hidden="true" /> Findings</span><span>Example data · no live scan</span></div>
      <div className="review-workbench">
        <div className="review-inbox">
          <div className="review-inbox-title"><strong>Findings</strong><span>2 open</span></div>
          <div className="review-inbox-branch"><GitBranch size={13} aria-hidden="true" /> main <span>Sample branch</span></div>
          <div className="review-finding-list" aria-label="Sample findings">
            {findings.map((item, index) => <button key={item.path} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} className="review-finding-row"><CircleDot size={14} className={index ? 'review-medium' : 'review-risk'} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.path}:{item.line}</small><span className={index ? 'review-medium' : 'review-risk'}>{item.severity}</span></span><ChevronRight size={13} aria-hidden="true" /></button>)}
          </div>
          <p className="review-inbox-help">Select a finding to inspect its source and recommended next step.</p>
        </div>
        <div className="review-finding" aria-live="polite" aria-atomic="true">
          <div className="review-finding-meta"><span className={selected ? 'review-medium' : 'review-risk'}><CircleDot size={13} aria-hidden="true" /> {finding.severity} severity</span><span>{finding.rule}</span></div>
          <h2>{finding.title}</h2>
          <p>{finding.risk}</p>
          <div className="review-code">
            <div><span><FileCode2 size={13} aria-hidden="true" /> {finding.path}</span><span>Source excerpt</span></div>
            <pre><code>{finding.code.map((line,index) => <span key={`${finding.path}-${index}`} className={index === 1 ? 'review-code-warning' : ''}><b>{finding.line + index}</b>{line}{'\n'}</span>)}</code></pre>
          </div>
          <div className="review-next"><strong>Recommended next step</strong><p>{finding.next}</p></div>
          <a className="review-dossier-link" href="#playground">Explore a patch example <ArrowUpRight size={15} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
