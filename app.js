// ============================================
// CONFIG
// ============================================
const SUPABASE_URL = 'https://bgmhubnhjnobnszgyerb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HacQmdpIXTKjEeSskPmK1g_5s4cxZap';

// ============================================
// INIT
// ============================================
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================
// PASSWORD GATE
// ============================================
function checkPassword() {
  if (localStorage.getItem('varodlingslott_auth') === 'true') {
    showApp();
    return;
  }
  $('#password-screen').hidden = false;
}

$('#password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const entered = $('#password-input').value;
  const btn = $('#password-form').querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Kontrollerar...';

  try {
    const { data, error } = await db.rpc('verify_password', { input_password: entered });
    if (error) throw error;

    if (data === true) {
      localStorage.setItem('varodlingslott_auth', 'true');
      localStorage.setItem('varodlingslott_name', '');
      showApp();
    } else {
      $('#password-error').hidden = false;
      $('#password-input').value = '';
      $('#password-input').focus();
    }
  } catch (err) {
    console.error('Password check error:', err);
    $('#password-error').hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kom in';
  }
});

function showApp() {
  $('#password-screen').hidden = true;
  $('#app').hidden = false;
  loadFeed();
}

// ============================================
// UPLOAD MODAL
// ============================================
$('#upload-btn').addEventListener('click', () => {
  $('#upload-modal').hidden = false;
  const savedName = localStorage.getItem('varodlingslott_name');
  if (savedName) $('#post-author').value = savedName;
});

$('#close-modal').addEventListener('click', closeModal);

$('#upload-modal').addEventListener('click', (e) => {
  if (e.target === $('#upload-modal')) closeModal();
});

function closeModal() {
  $('#upload-modal').hidden = true;
  $('#upload-form').reset();
  $('#image-preview').hidden = true;
  $('#file-label').classList.remove('has-file');
  $('#file-label span').textContent = 'Välj bild...';
}

// Tab switching
$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const type = tab.dataset.tab;
    $('#post-type').value = type;
    $('#image-fields').hidden = type !== 'image';
    $('#video-fields').hidden = type !== 'video';
  });
});

// File preview
$('#file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $('#file-label').classList.add('has-file');
  $('#file-label span').textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    $('#image-preview').src = ev.target.result;
    $('#image-preview').hidden = false;
  };
  reader.readAsDataURL(file);
});

// ============================================
// IMAGE RESIZING
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

// ============================================
// YOUTUBE HELPERS
// ============================================
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
// UPLOAD / CREATE POST
// ============================================
$('#upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#submit-btn');
  btn.disabled = true;
  btn.textContent = 'Laddar upp...';

  try {
    const type = $('#post-type').value;
    const caption = $('#post-caption').value.trim();
    const author = $('#post-author').value.trim() || 'Anonym';
    let url = '';

    localStorage.setItem('varodlingslott_name', author);

    if (type === 'image') {
      const file = $('#file-input').files[0];
      if (!file) {
        alert('Välj en bild först.');
        return;
      }
      const resized = await resizeImage(file);
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await db.storage
        .from('images')
        .upload(fileName, resized, { contentType: resized.type || 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = db.storage.from('images').getPublicUrl(fileName);
      url = urlData.publicUrl;
    } else {
      const ytUrl = $('#youtube-url').value.trim();
      const videoId = extractYouTubeId(ytUrl);
      if (!videoId) {
        alert('Ogiltig YouTube-länk. Försök igen.');
        return;
      }
      url = youtubeEmbedUrl(videoId);
    }

    const { error: insertError } = await db
      .from('posts')
      .insert({ type, url, caption: caption || null, author_name: author });

    if (insertError) throw insertError;

    closeModal();
    await loadFeed();
  } catch (err) {
    console.error('Upload error:', err);
    alert('Något gick fel. Försök igen.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ladda upp';
  }
});

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
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    $('#loading').hidden = true;

    if (!posts || posts.length === 0) {
      $('#empty-state').hidden = false;
      return;
    }

    for (const post of posts) {
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
  const card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.postId = post.id;

  let mediaHtml = '';
  if (post.type === 'image') {
    mediaHtml = `<div class="post-media"><img src="${post.url}" alt="${post.caption || ''}" loading="lazy"></div>`;
  } else {
    mediaHtml = `<div class="post-media"><div class="video-wrapper"><iframe src="${post.url}" allowfullscreen loading="lazy"></iframe></div></div>`;
  }

  const date = formatDate(post.created_at);
  const captionHtml = post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : '';

  card.innerHTML = `
    ${mediaHtml}
    <div class="post-info">
      ${captionHtml}
      <p class="post-meta">${escapeHtml(post.author_name)} · ${date}</p>
    </div>
    <div class="comments-section">
      <button class="comments-toggle">Kommentarer</button>
      <div class="comments-body" hidden>
        <div class="comments-list"></div>
        <form class="comment-form">
          <input type="text" name="author" placeholder="Ditt namn" required>
          <input type="text" name="body" placeholder="Skriv en kommentar..." required style="flex:2;">
          <button type="submit">Skicka</button>
        </form>
      </div>
    </div>
  `;

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
    const authorInput = commentForm.querySelector('[name="author"]');
    const bodyInput = commentForm.querySelector('[name="body"]');
    const author = authorInput.value.trim() || 'Anonym';
    const commentBody = bodyInput.value.trim();
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

    bodyInput.value = '';
    loadComments(post.id, card);
  });

  return card;
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
checkPassword();
