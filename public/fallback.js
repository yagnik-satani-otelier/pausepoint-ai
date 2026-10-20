(function (root) {
  'use strict';
  function makeFallback(payload, reason) {
    const p = payload || {};
    const project = String(p.projectName || 'Untitled project').slice(0, 100);
    const goal = String(p.goal || '').slice(0, 500);
    const stopped = String(p.stoppedAt || '').slice(0, 1200);
    const changed = String(p.changed || '').slice(0, 1200);
    const verifiedText = String(p.verified || '').slice(0, 1000);
    const uncertainText = String(p.unverified || '').slice(0, 1000);
    const blocker = String(p.blocker || '').slice(0, 1000);
    const nextHint = String(p.nextHint || '').slice(0, 1000);
    const verified = [];
    if (changed) verified.push(`Reported change: ${changed}`);
    if (verifiedText) verified.push(`Reported as verified: ${verifiedText}`);
    if (p.branch) verified.push(`Git branch snapshot: ${String(p.branch).slice(0,160)}`);
    if (p.gitStatus) verified.push(`Git status snapshot: ${String(p.gitStatus).split('\n').slice(0,5).join('; ')}`);
    const unverified = [];
    if (uncertainText) unverified.push(uncertainText);
    if (blocker) unverified.push(`Blocker still needs attention: ${blocker}`);
    if (!verifiedText) unverified.push('No test result was explicitly recorded in this capsule.');
    const steps = [];
    if (blocker) steps.push(`Reproduce or inspect the blocker: ${blocker}`);
    if (nextHint) steps.push(nextHint);
    else if (stopped) steps.push(`Resume by checking the stopping point: ${stopped}`);
    else if (goal) steps.push(`Re-read the goal and identify the smallest unfinished part: ${goal}`);
    steps.push('Inspect the current working tree before editing anything.');
    return {
      mode: 'template', model: null,
      notice: reason || 'Local API is unavailable in this hosted preview. Used the browser template; run locally with Ollama for Gemma generation.',
      capsule: {
        title: `${project}: resume capsule`,
        summary: `A local checkpoint for ${project}. Start with the supplied facts, verify the current state, and take one small next step.`,
        workingOn: goal || stopped || changed || 'The exact task needs clarification from the notes.',
        verified: verified.slice(0,6),
        unverified: unverified.slice(0,6),
        nextSteps: [...new Set(steps)].slice(0,4),
        firstCommand: '',
        returnPrompt: `Resume work on ${project}. First inspect the current Git status and read these notes. Goal: ${goal || 'not recorded'}. Stopped at: ${stopped || 'not recorded'}. Reported changes: ${changed || 'not recorded'}. Verified: ${verifiedText || 'not recorded'}. Still uncertain: ${uncertainText || 'not recorded'}. Blocker: ${blocker || 'none recorded'}. Do not assume anything that is not in the notes; ask before destructive changes.`
      }
    };
  }
  root.PausePointFallback = { makeFallback };
})(typeof window !== 'undefined' ? window : globalThis);
