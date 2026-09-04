'use client';

import type { QRDesignDocument } from '@moduqr/shared';
import { Copy, Heart, Pencil, Play, Search, Tag, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { deleteProject, duplicateProject, listProjects, normalizeProjectTags, saveProject } from '@/lib/projects';

export function ProjectsView() {
  const router = useRouter();
  const [projects, setProjects] = useState<readonly QRDesignDocument[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'updated' | 'name'>('updated');
  const [status, setStatus] = useState('');

  const runAction = async (action: () => Promise<void>, success: string) => {
    try {
      await action();
      setProjects(await listProjects());
      setStatus(success);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The local project action failed.');
    }
  };

  useEffect(() => {
    let active = true;
    void listProjects()
      .then((storedProjects) => {
        if (active) setProjects(storedProjects);
      })
      .catch((error: unknown) => {
        if (active) setStatus(error instanceof Error ? error.message : 'Could not load local projects.');
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    const filtered = projects.filter((project) => {
      const searchablePayload = project.payloadType === 'wifi' ? '' : project.payload.toLowerCase();
      const searchableTags = project.tags.join(' ').toLowerCase();
      return project.name.toLowerCase().includes(normalizedQuery) || searchablePayload.includes(normalizedQuery) || searchableTags.includes(normalizedQuery);
    });
    return [...filtered].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt));
  }, [projects, query, sort]);

  const update = async (project: QRDesignDocument, patch: Partial<QRDesignDocument>, success: string) => {
    await runAction(() => saveProject({ ...project, ...patch, updatedAt: new Date().toISOString() }), success);
  };

  const load = (project: QRDesignDocument) => {
    try {
      window.sessionStorage.setItem('moduqr-load-project-id', project.id);
      router.push('/generator');
    } catch {
      setStatus('Session storage is unavailable, so this project cannot be transferred to the editor in this tab.');
    }
  };

  return <div>
    <div className="projects-toolbar"><div className="field" style={{ flex: 1 }}><label htmlFor="project-search">Search</label><div style={{ position: 'relative' }}><Search size={15} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--muted)' }}/><input id="project-search" className="input" style={{ paddingLeft: 34 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, tag, or non-sensitive content"/></div></div><div className="field"><label htmlFor="project-sort">Sort</label><select id="project-sort" className="select" value={sort} onChange={(event) => setSort(event.target.value as 'updated' | 'name')}><option value="updated">Recently updated</option><option value="name">Name</option></select></div></div>
    {status ? <p role="status">{status}</p> : null}
    {visible.length === 0 ? <div className="scanner-result"><h2>No local projects yet</h2><p>Save a design in QR Studio and it will appear here. Nothing is uploaded.</p></div> : <div className="projects-grid">{visible.map((project) => <article className="project-card" key={project.id}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h2 style={{ flex: 1 }}>{project.name}</h2><button className="icon-button" type="button" aria-label={project.favorite ? 'Remove favorite' : 'Add favorite'} onClick={() => void update(project, { favorite: !project.favorite }, project.favorite ? 'Removed from favorites.' : 'Added to favorites.')}><Heart size={15} fill={project.favorite ? 'currentColor' : 'none'}/></button></div><p>{project.payloadType.toUpperCase()} · revision {project.revision} · {new Date(project.updatedAt).toLocaleString()}</p>{project.tags.length > 0 ? <div className="tag-list" aria-label="Project tags">{project.tags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)}</div> : null}<p>{project.payloadType === 'wifi' ? 'WiFi credentials hidden in the project list.' : project.payload.slice(0, 120)}</p><div className="project-actions"><button className="button accent" type="button" onClick={() => load(project)}><Play size={14}/> Load</button><button className="button" type="button" onClick={() => void runAction(() => saveProject(duplicateProject(project)), 'Project duplicated.')}><Copy size={14}/> Duplicate</button><button className="button" type="button" onClick={() => { const name = window.prompt('Rename project', project.name); if (name?.trim()) void update(project, { name: name.trim() }, 'Project renamed.'); }}><Pencil size={14}/> Rename</button><button className="button" type="button" onClick={() => { const tags = window.prompt('Project tags (comma-separated)', project.tags.join(', ')); if (tags !== null) void update(project, { tags: normalizeProjectTags(tags.split(',')) }, 'Project tags updated.'); }}><Tag size={14}/> Tags</button><button className="button danger" type="button" onClick={() => { if (window.confirm(`Delete “${project.name}”? This cannot be undone.`)) void runAction(() => deleteProject(project.id), 'Project deleted.'); }}><Trash2 size={14}/> Delete</button></div></article>)}</div>}
  </div>;
}
