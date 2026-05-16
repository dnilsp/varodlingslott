// ============================================
// CONFIG
// ============================================
const SUPABASE_URL = 'https://bgmhubnhjnobnszgyerb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HacQmdpIXTKjEeSskPmK1g_5s4cxZap';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Composer state
let composerPostId = null;
let composerBlocks = [];
let composerIsEdit = false;
let pendingImageFile = null;

// ============================================
// AUTH (top right)
// ============================================
function isLoggedIn() {
  return localStorage.getItem('varodlingslott_auth') === 'true';
}

function renderAuthArea() {
  const area = $('#auth-area');
  if (isLoggedIn()) {
    area.innerHTML = `
      <div class="auth-logged-in">
        <span>Inloggad</span>
        <button type="button" class="btn-ghost" id="logout-btn">Logga ut</button>
      </div>
    `;
    $('#logout-btn').addEventListener('click', logout);
    $('#toolbar').hidden = false;
  } else {
    area.innerHTML = `
      <form class="auth-form" id="auth-form">
        <input type="password" id="auth-password" placeholder="Lösenord" autocomplete="off" required>
        <button type="submit" class="btn-primary">Logga in</button>
        <span id="auth-error" class="auth-error" hidden>Fel lösenord</span>
      </form>
    `;
    $('#auth-form').addEventListener('submit', handleLogin);
    $('#toolbar').hidden = true;
    closeComposer();
  }

  loadFeed();
}

async function handleLogin(e) {
  e.preventDefault();
  const input = $('#auth-password');
  const btn = $('#auth-form').querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    const { data, error } = await db.rpc('verify_password', { input_password: input.value });
    if (error) throw error;

    if (data === true) {
      localStorage.setItem('varodlingslott_auth', 'true');
      $('#auth-error').hidden = true;
      renderAuthArea();
    } else {
      $('#auth-error').hidden = false;
      input.value = '';
    }
  } catch (err) {
    console.error('Login error:', err);
    $('#auth-error').hidden = false;
  } finally {
    btn.disabled = false;
  }
}

function logout() {
  localStorage.removeItem('varodlingslott_auth');
  closeComposer();
  renderAuthArea();
}

// ============================================
// COMPOSER
// ============================================
$('#new-post-btn').addEventListener('click', () => openComposerNew());
$('#close-composer').addEventListener('click', () => cancelComposer());
$('#cancel-composer-btn').addEventListener('click', () => cancelComposer());
$('#start-post-btn').addEventListener('click', () => startDraftPost());
$('#publish-btn').addEventListener('click', () => publishPost());

$$('.composer-add-buttons [data-add]').forEach((btn) => {
  btn.addEventListener('click', () => showAddBlockForm(btn.dataset.add));
});

$('#hidden-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) pendingImageFile = file;
});

function openComposerNew() {
  composerPostId = null;
  composerBlocks = [];
  composerIsEdit = false;
  pendingImageFile = null;

  $('#composer-heading').textContent = 'Nytt inlägg';
  $('#composer').hidden = false;
  $('#composer-start').hidden = false;
  $('#composer-body').hidden = true;
  $('#composer-title').value = '';
  $('#composer-author').value = localStorage.getItem('varodlingslott_name') || '';
  hideAddBlockForm();
  $('#composer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openComposerEdit(postId) {
  try {
    const { data: post, error: postErr } = await db.from('posts').select('*').eq('id', postId).single();
    if (postErr) throw postErr;

    const { data: blocks, error: blockErr } = await db
      .from('post_blocks')
      .select('*')
      .eq('post_id', postId)
      .order('position', { ascending: true });
    if (blockErr) throw blockErr;

    composerPostId = post.id;
    composerBlocks = (blocks || []).map((b) => ({
      id: b.id,
      type: b.type,
      content: b.content,
    }));
    composerIsEdit = true;
    pendingImageFile = null;

    $('#composer-heading').textContent = 'Redigera inlägg';
    $('#composer').hidden = false;
    $('#composer-start').hidden = true;
    $('#composer-body').hidden = false;
    $('#composer-title-display').textContent = post.title;
    hideAddBlockForm();
    renderComposerBlocks();
    $('#composer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error('Edit load error:', err);
    alert('Kunde inte ladda inlägget.');
  }
}

async function startDraftPost() {
  const title = $('#composer-title').value.trim();
  const author = $('#composer-author').value.trim() || 'Anonym';
  if (!title) {
    alert('Ange en titel.');
    return;
  }

  localStorage.setItem('varodlingslott_name', author);

  try {
    const { data, error } = await db
      .from('posts')
      .insert({ title, author_name: author, status: 'draft' })
      .select()
      .single();
    if (error) throw error;

    composerPostId = data.id;
    composerBlocks = [];
    composerIsEdit = false;

    $('#composer-start').hidden = true;
    $('#composer-body').hidden = false;
    $('#composer-title-display').textContent = title;
    renderComposerBlocks();
  } catch (err) {
    console.error('Draft error:', err);
    alert('Kunde inte skapa inlägg.');
  }
}

function showAddBlockForm(type) {
  const form = $('#composer-add-form');
  form.hidden = false;
  pendingImageFile = null;

  if (type === 'text') {
    form.innerHTML = `
      <textarea id="add-block-input" placeholder="Skriv text..."></textarea>
      <button type="button" class="btn-primary" id="confirm-add-block">Lägg till text</button>
      <button type="button" class="btn-ghost" id="cancel-add-block">Avbryt</button>
    `;
  } else if (type === 'subtitle') {
    form.innerHTML = `
      <input type="text" id="add-block-input" placeholder="Underrubrik">
      <button type="button" class="btn-primary" id="confirm-add-block">Lägg till underrubrik</button>
      <button type="button" class="btn-ghost" id="cancel-add-block">Avbryt</button>
    `;
  } else if (type === 'image') {
    form.innerHTML = `
      <label class="file-label" for="hidden-file-input">Välj bild...</label>
      <button type="button" class="btn-primary" id="confirm-add-block">Lägg till bild</button>
      <button type="button" class="btn-ghost" id="cancel-add-block">Avbryt</button>
    `;
    $('#hidden-file-input').value = '';
  } else if (type === 'video') {
    form.innerHTML = `
      <input type="url" id="add-block-input" placeholder="YouTube-länk">
      <button type="button" class="btn-primary" id="confirm-add-block">Lägg till video</button>
      <button type="button" class="btn-ghost" id="cancel-add-block">Avbryt</button>
    `;
  }

  $('#confirm-add-block').addEventListener('click', () => confirmAddBlock(type));
  $('#cancel-add-block').addEventListener('click', hideAddBlockForm);
}

function hideAddBlockForm() {
  $('#composer-add-form').hidden = true;
  $('#composer-add-form').innerHTML = '';
  pendingImageFile = null;
  $('#hidden-file-input').value = '';
}

async function confirmAddBlock(type) {
  let content = '';

  if (type === 'image') {
    if (!pendingImageFile) {
      alert('Välj en bild först.');
      return;
    }
    try {
      content = await uploadImage(pendingImageFile);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Kunde inte ladda upp bilden.');
      return;
    }
  } else {
    const input = $('#add-block-input');
    content = input?.value.trim() || '';
    if (!content) {
      alert('Fyll i innehåll först.');
      return;
    }
    if (type === 'video') {
      const videoId = extractYouTubeId(content);
      if (!videoId) {
        alert('Ogiltig YouTube-länk.');
        return;
      }
      content = youtubeEmbedUrl(videoId);
    }
  }

  composerBlocks.push({ type, content });
  renderComposerBlocks();
  hideAddBlockForm();
}

function renderComposerBlocks() {
  const container = $('#composer-blocks');
  if (composerBlocks.length === 0) {
    container.innerHTML = '<p style="color:#777;font-size:0.9rem;">Inget innehåll ännu. Lägg till text, bild eller video.</p>';
    return;
  }

  container.innerHTML = composerBlocks
    .map((block, i) => {
      const preview = renderBlockContent(block, true);
      return `
        <div class="composer-block-preview" data-index="${i}">
          <button type="button" class="remove-block" data-index="${i}" aria-label="Ta bort">&times;</button>
          ${preview}
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.remove-block').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      composerBlocks.splice(idx, 1);
      renderComposerBlocks();
    });
  });
}

async function publishPost() {
  if (!composerPostId) return;

  const btn = $('#publish-btn');
  btn.disabled = true;
  btn.textContent = 'Sparar...';

  try {
    const { error: postErr } = await db
      .from('posts')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', composerPostId);
    if (postErr) throw postErr;

    await saveBlocks(composerPostId);

    closeComposer();
    await loadFeed();
  } catch (err) {
    console.error('Publish error:', err);
    alert('Kunde inte publicera inlägget.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Avsluta inlägg';
  }
}

async function saveBlocks(postId) {
  const { error: delErr } = await db.from('post_blocks').delete().eq('post_id', postId);
  if (delErr) throw delErr;

  if (composerBlocks.length === 0) return;

  const rows = composerBlocks.map((b, i) => ({
    post_id: postId,
    position: i,
    type: b.type,
    content: b.content,
  }));

  const { error: insErr } = await db.from('post_blocks').insert(rows);
  if (insErr) throw insErr;
}

async function cancelComposer() {
  if (composerPostId && !composerIsEdit) {
    const { data: post } = await db.from('posts').select('status').eq('id', composerPostId).single();
    if (post?.status === 'draft') {
      await deletePostById(composerPostId, false);
    }
  }
  closeComposer();
}

function closeComposer() {
  composerPostId = null;
  composerBlocks = [];
  composerIsEdit = false;
  pendingImageFile = null;
  $('#composer').hidden = true;
  hideAddBlockForm();
}

// ============================================
// FEED
// ============================================
async function loadFeed() {
  $('#loading').hidden = false;
  $('#empty-state').hidden = true;
  $('#feed').innerHTML = '';

  try {
    const { data: posts, error } = await db
      .from('posts')
      .select('*, post_blocks(*)')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) throw error;

    $('#loading').hidden = true;

    if (!posts || posts.length === 0) {
      $('#empty-state').hidden = false;
      return;
    }

    for (const post of posts) {
      if (post.post_blocks) {
        post.post_blocks.sort((a, b) => a.position - b.position);
      }
      const card = createPostCard(post);
      $('#feed').appendChild(card);
      loadComments(post.id, card);
    }
  } catch (err) {
    console.error('Feed error:', err);
    $('#loading').hidden = true;
    $('#feed').innerHTML = '<p style="text-align:center;color:#c0392b;">Kunde inte ladda inlägg.</p>';
  }
}

function createPostCard(post) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.dataset.postId = post.id;

  const blocksHtml = (post.post_blocks || [])
    .map((b) => renderBlockContent(b, false))
    .join('');

  const actionsHtml = isLoggedIn()
    ? `
      <div class="post-card-actions">
        <button type="button" class="edit-post-btn">Redigera</button>
        <button type="button" class="delete-post-btn">Ta bort</button>
      </div>
    `
    : '';

  card.innerHTML = `
    <div class="post-card-header">
      <h2 class="post-card-title">${escapeHtml(post.title)}</h2>
      ${actionsHtml}
    </div>
    <div class="post-blocks">${blocksHtml || '<p class="block-text" style="color:#777">Inget innehåll.</p>'}</div>
    <p class="post-author">${escapeHtml(post.author_name)}</p>
    <div class="comments-section">
      <button type="button" class="comments-toggle">Kommentarer</button>
      <div class="comments-body" hidden>
        <div class="comments-list"></div>
        <form class="comment-form">
          <input type="text" name="author" placeholder="Ditt namn" required>
          <input type="text" name="body" placeholder="Skriv en kommentar..." required style="flex:2">
          <button type="submit">Skicka</button>
        </form>
      </div>
    </div>
    <p class="post-date">${formatDate(post.created_at)}</p>
  `;

  if (isLoggedIn()) {
    card.querySelector('.edit-post-btn').addEventListener('click', () => openComposerEdit(post.id));
    card.querySelector('.delete-post-btn').addEventListener('click', () => {
      if (confirm('Ta bort detta inlägg? Det går inte att ångra.')) {
        deletePostById(post.id, true);
      }
    });
  }

  const toggle = card.querySelector('.comments-toggle');
  const body = card.querySelector('.comments-body');
  toggle.addEventListener('click', () => {
    body.hidden = !body.hidden;
  });

  const commentForm = card.querySelector('.comment-form');
  const savedName = localStorage.getItem('varodlingslott_name');
  if (savedName) commentForm.querySelector('[name="author"]').value = savedName;

  commentForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const author = commentForm.querySelector('[name="author"]').value.trim() || 'Anonym';
    const commentBody = commentForm.querySelector('[name="body"]').value.trim();
    if (!commentBody) return;

    localStorage.setItem('varodlingslott_name', author);

    const { error } = await db.from('comments').insert({
      post_id: post.id,
      author_name: author,
      body: commentBody,
    });

    if (error) {
      console.error('Comment error:', error);
      return;
    }

    commentForm.querySelector('[name="body"]').value = '';
    loadComments(post.id, card);
  });

  return card;
}

function renderBlockContent(block, isPreview) {
  switch (block.type) {
    case 'subtitle':
      return `<h3 class="block-subtitle">${escapeHtml(block.content)}</h3>`;
    case 'text':
      return `<p class="block-text">${escapeHtml(block.content)}</p>`;
    case 'image':
      return `<div class="block-media"><img src="${escapeHtml(block.content)}" alt="" loading="lazy"></div>`;
    case 'video':
      return `<div class="block-media"><div class="video-wrapper"><iframe src="${escapeHtml(block.content)}" allowfullscreen loading="lazy"></iframe></div></div>`;
    default:
      return '';
  }
}

async function deletePostById(postId, reload) {
  try {
    const { data: blocks } = await db.from('post_blocks').select('type, content').eq('post_id', postId);
    if (blocks) {
      for (const b of blocks) {
        if (b.type === 'image') await deleteStorageImage(b.content);
      }
    }

    const { error } = await db.from('posts').delete().eq('id', postId);
    if (error) throw error;

    if (reload) await loadFeed();
  } catch (err) {
    console.error('Delete error:', err);
    alert('Kunde inte ta bort inlägget.');
  }
}

async function deleteStorageImage(publicUrl) {
  const marker = '/images/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  await db.storage.from('images').remove([path]);
}

// ============================================
// COMMENTS
// ============================================
async function loadComments(postId, card) {
  const list = card.querySelector('.comments-list');
  const toggle = card.querySelector('.comments-toggle');

  const { data: comments, error } = await db
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Comments load error:', error);
    return;
  }

  const count = comments ? comments.length : 0;
  toggle.textContent = count > 0 ? `Kommentarer (${count})` : 'Kommentarer';

  if (!comments || comments.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = comments
    .map(
      (c) => `
      <div class="comment">
        <span class="comment-author">${escapeHtml(c.author_name)}</span>
        ${escapeHtml(c.body)}
        <span class="comment-time">· ${formatDate(c.created_at)}</span>
      </div>
    `
    )
    .join('');
}

// ============================================
// MEDIA HELPERS
// ============================================
function resizeImage(file, maxWidth = 1600) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        if (img.width <= maxWidth) {
          resolve(file);
          return;
        }
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file) {
  const resized = await resizeImage(file);
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await db.storage
    .from('images')
    .upload(fileName, resized, { contentType: resized.type || 'image/jpeg' });
  if (error) throw error;

  const { data } = db.storage.from('images').getPublicUrl(fileName);
  return data.publicUrl;
}

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

function youtubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}`;
}

// ============================================
// HELPERS
// ============================================
function formatDate(iso) {
  const d = new Date(iso);
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// START
// ============================================
renderAuthArea();
