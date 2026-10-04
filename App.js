import 'react-native-url-polyfill/auto';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, Animated, AppState, FlatList, ScrollView, Linking, Alert, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, Share, Image, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
const RED = '#e5101a';
const ROLES = { admin: 'Admin', editor: 'Editor', member: 'Membro', banned: 'Suspenso' };
const Title = () => (
  <View style={s.head}>
    <Text style={s.suits}>♦ ♠ ♣ ♥</Text>
    <Text style={s.logo}>Alice in Borderland</Text>
    <Text style={s.by}>Uma série de Rafael Bondim</Text>
  </View>
);

function Auth() {
  const [mode, setMode] = useState('in'), [email, setEmail] = useState(''), [pw, setPw] = useState(''), [name, setName] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = mode === 'in'
      ? await sb.auth.signInWithPassword({ email: email.trim(), password: pw })
      : await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { name: name.trim() || email.split('@')[0] } } });
    setBusy(false);
    if (r.error) Alert.alert('Não foi possível entrar', r.error.message);
  };
  return (
    <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
      <Title />
      <View style={{ padding: 20 }}>
        {mode === 'up' && <TextInput style={s.in} placeholder="Seu nome" placeholderTextColor="#888" value={name} onChangeText={setName} />}
        <TextInput style={s.in} placeholder="E-mail" placeholderTextColor="#888" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={s.in} placeholder="Senha (mín. 6 caracteres)" placeholderTextColor="#888" secureTextEntry value={pw} onChangeText={setPw} />
        <TouchableOpacity style={s.btn} onPress={go} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.bt}>{mode === 'in' ? 'Entrar' : 'Criar conta'}</Text>}</TouchableOpacity>
        <TouchableOpacity onPress={() => setMode(mode === 'in' ? 'up' : 'in')}><Text style={s.link}>{mode === 'in' ? 'Ainda não tenho conta' : 'Já tenho conta'}</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Chat({ me, isAdmin }) {
  const [msgs, setMsgs] = useState([]), [t, setT] = useState('');
  const load = useCallback(async () => {
    const { data } = await sb.from('messages').select('id,text,user_id,profiles(name)').order('created_at', { ascending: false }).limit(100);
    setMsgs(data || []);
  }, []);
  useEffect(() => {
    load();
    const ch = sb.channel('chat').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [load]);
  const send = async () => {
    const text = t.trim(); if (!text) return; setT('');
    const { error } = await sb.from('messages').insert({ text });
    if (error) Alert.alert('Não foi possível enviar', error.message);
  };
  const del = id => (isAdmin || true) && sb.from('messages').delete().eq('id', id).then(load);
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList inverted data={msgs} keyExtractor={m => String(m.id)} contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={<Text style={[s.mut, { transform: [{ scaleY: -1 }] }]}>Seja o primeiro a falar ♠</Text>}
        renderItem={({ item: m }) => {
          const mine = m.user_id === me.id;
          return (
            <TouchableOpacity activeOpacity={0.8} onLongPress={() => (mine || isAdmin) && Alert.alert('Apagar mensagem?', '', [{ text: 'Cancelar' }, { text: 'Apagar', style: 'destructive', onPress: () => del(m.id) }])}
              style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <Text style={s.mut}>{mine ? 'Você' : m.profiles?.name || 'Alguém'}</Text>
              <View style={[s.bub, mine && { backgroundColor: RED }]}><Text style={s.bt}>{m.text}</Text></View>
            </TouchableOpacity>
          );
        }} />
      <View style={s.send}>
        <TextInput style={[s.in, { flex: 1, marginBottom: 0 }]} placeholder="Escreva uma mensagem…" placeholderTextColor="#888" maxLength={400} value={t} onChangeText={setT} onSubmitEditing={send} />
        <TouchableOpacity style={[s.btn, { marginTop: 0, marginLeft: 8, justifyContent: 'center' }]} onPress={send}><Text style={s.bt}>Enviar</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Admin() {
  const [users, setUsers] = useState([]);
  const load = useCallback(async () => { const { data } = await sb.from('profiles').select('*').order('name'); setUsers(data || []); }, []);
  useEffect(() => { load(); }, [load]);
  const setRole = async (id, role) => { const { error } = await sb.from('profiles').update({ role }).eq('id', id); if (error) Alert.alert('Erro', error.message); load(); };
  return (
    <View style={{ paddingTop: 8 }}>
      <Text style={s.mut}>Admin: posta, edita, muda cargos e apaga mensagens. Editor: posta episódios. Membro: vota e conversa. Suspenso: só lê.</Text>
      {users.map(u => (
        <View key={u.id} style={s.card}>
          <Text style={s.h}>{u.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {Object.keys(ROLES).map(r => (
              <TouchableOpacity key={r} style={[s.chip, u.role === r && s.numOn]} onPress={() => setRole(u.id, r)}><Text style={s.bt}>{ROLES[r]}</Text></TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const AP = Animated.createAnimatedComponent(Pressable);

function TouchableOpacity({ style, onPress, onLongPress, disabled, children }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = n => Animated.spring(v, { toValue: n, useNativeDriver: true, speed: 50 }).start();
  return <AP onPress={onPress} onLongPress={onLongPress} disabled={disabled} onPressIn={() => to(0.94)} onPressOut={() => to(1)} style={[style, { transform: [{ scale: v }] }]}>{children}</AP>;
}

function Fade({ children }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: true }).start(); }, [v]);
  return <Animated.View style={{ flex: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>{children}</Animated.View>;
}


const SUITS = ['♠', '♦', '♣', '♥'];
const CRIT = [['roteiro', 'Roteiro'], ['personagens', 'Personagens'], ['jogo', 'Jogo'], ['direcao', 'Direção'], ['final', 'Final']];
const TOPICS = ['Teoria', 'Melhor jogo', 'Melhor personagem', 'Geral'];
const avg = a => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0);
const f1 = n => (n ? n.toFixed(1) : '–');
const lab = e => `T${e.season}·EP${e.number}`;
const sInfo = (D, id, uid) => { const l = D.rs.filter(r => r.episode_id === id), m = l.find(r => r.user_id === uid); return { n: l.length, a: avg(l.map(r => +r.score)), mine: m ? +m.score : null }; };
const add = async (t, o, D) => { const { error } = await sb.from(t).insert(o); if (error) { Alert.alert('Erro', error.message); return false; } D.reload(); return true; };
const del = (t, id, D) => Alert.alert('Excluir?', '', [{ text: 'Cancelar' }, { text: 'Excluir', style: 'destructive', onPress: async () => { await sb.from(t).delete().eq('id', id); D.reload(); } }]);
const Stat = ({ n, l }) => <View style={s.stat}><Text style={s.statN}>{n}</Text><Text style={s.mut}>{l}</Text></View>;

function Bars({ items, onPress }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={s.bars}>
        {items.map(i => (
          <TouchableOpacity key={i.k} style={s.barC} onPress={() => onPress && onPress(i)}>
            <Text style={s.mut}>{f1(i.v)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110 }}>
              <View style={[s.bar, { height: i.v * 11 }]} />
              {i.v2 != null && <View style={[s.bar, s.bar2, { height: i.v2 * 11 }]} />}
            </View>
            <Text style={s.mut}>{i.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function Form({ title, fields, onSave, extra }) {
  const [v, setV] = useState({});
  return (
    <View style={s.card}>
      <Text style={s.h}>{title}</Text>
      {fields.map(f => <TextInput key={f.k} style={[s.in, f.m && { height: 70 }]} multiline={!!f.m} placeholder={f.p} placeholderTextColor="#888" keyboardType={f.n ? 'number-pad' : 'default'} value={v[f.k] || ''} onChangeText={x => setV({ ...v, [f.k]: x })} />)}
      {extra && extra(v, setV)}
      <TouchableOpacity style={s.btn} onPress={async () => { if (await onSave(v)) setV({}); }}><Text style={s.bt}>Publicar</Text></TouchableOpacity>
    </View>
  );
}

function Home({ D, me, open }) {
  const [q, setQ] = useState('');
  const eps = D.eps, rated = new Set(D.rs.filter(r => r.user_id === me.id).map(r => r.episode_id));
  const next = eps.find(e => !rated.has(e.id)), all = D.rs.map(r => +r.score);
  const ranked = eps.map(e => ({ e, a: sInfo(D, e.id, me.id).a })).filter(x => x.a > 0).sort((x, y) => y.a - x.a);
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      <TextInput style={s.in} placeholder="🔍 Buscar episódio, personagem, jogo…" placeholderTextColor="#888" value={q} onChangeText={setQ} />
      {q.length > 1 ? <Results q={q} D={D} open={open} /> : <>
      <View style={s.hero}>
        <Text style={s.watermark}>♠</Text>
        <Text style={s.heroS}>VOCÊ ESTÁ NA FRONTEIRA</Text>
        <Text style={s.heroT}>{next ? lab(next) : eps.length ? 'Tudo avaliado' : 'Em breve'}</Text>
        <Text style={s.heroQ}>{next ? next.title : 'Os episódios aparecem aqui.'}</Text>
        {next && <TouchableOpacity style={[s.btn, { backgroundColor: '#000' }]} onPress={() => open(next)}><Text style={s.bt}>▶ CONTINUAR</Text></TouchableOpacity>}
      </View>
      <View style={s.row}><Stat n={f1(avg(all))} l="nota da série" /><Stat n={eps.length} l="episódios" /><Stat n={all.length} l="avaliações" /></View>
      {ranked[0] && <TouchableOpacity style={s.card} onPress={() => open(ranked[0].e)}><Text style={s.glyph}>♥</Text><Text style={s.tag}>EM DESTAQUE</Text><Text style={s.h}>{ranked[0].e.title}</Text><Text style={s.mut}>{lab(ranked[0].e)} · ★ {f1(ranked[0].a)}</Text></TouchableOpacity>}
      <Text style={s.sec}>GRÁFICO DA SÉRIE</Text>
      <Bars items={eps.map(e => ({ k: e.id, label: 'E' + e.number, v: sInfo(D, e.id, me.id).a, e }))} onPress={i => open(i.e)} />
      <Text style={s.sec}>TOP EPISÓDIOS</Text>
      {ranked.slice(0, 5).map((x, i) => <TouchableOpacity key={x.e.id} style={s.card} onPress={() => open(x.e)}><Text style={s.h}>{i + 1}. {x.e.title}</Text><Text style={s.mut}>{lab(x.e)} · ★ {f1(x.a)}</Text></TouchableOpacity>)}
    </>}
    </ScrollView>
  );
}

function Episodes({ D, me, canPost, open }) {
  const seasons = [...new Set(D.eps.map(e => e.season))];
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      {canPost && <Form title="♣ Postar episódio" fields={[{ k: 'season', p: 'Temporada', n: 1 }, { k: 'number', p: 'Episódio', n: 1 }, { k: 'title', p: 'Título' }, { k: 'synopsis', p: 'Sinopse', m: 1 }, { k: 'link', p: 'Link para assistir (opcional)' }, { k: 'image', p: 'Imagem (URL, opcional)' }, { k: 'dur', p: 'Duração em minutos', n: 1 }]}
        onSave={v => (!v.season || !v.number || !v.title ? (Alert.alert('Preencha temporada, episódio e título.'), false) : add('episodes', { season: +v.season, number: +v.number, title: v.title, synopsis: v.synopsis || '', link: v.link || '', image: v.image || '', duration: +v.dur || null }, D))} />}
      {seasons.length === 0 && <Text style={s.mut}>Nenhum episódio postado ainda.</Text>}
      {seasons.map(n => (
        <View key={n}>
          <Text style={s.sec}>TEMPORADA {n}</Text>
          {D.eps.filter(e => e.season === n).map(e => {
            const i = sInfo(D, e.id, me.id);
            return (
              <TouchableOpacity key={e.id} style={s.card} onPress={() => open(e)}>
                <Text style={s.glyph}>{SUITS[(e.number - 1) % 4]}</Text>
                <Text style={s.tag}>{lab(e)}</Text><Text style={s.h}>{e.title}</Text>
                <Text style={s.mut}>★ {f1(i.a)} ({i.n}) · {i.mine != null ? 'sua nota ' + i.mine.toFixed(1) : 'avalie agora'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

function EpisodeView({ e, D, me, canPost, back }) {
  const st = sInfo(D, e.id, me.id), [sc, setSc] = useState(st.mine != null ? st.mine : 8);
  const [cm, setCm] = useState([]), [t, setT] = useState(''), [sp, setSp] = useState(false), [op, setOp] = useState({});
  const [cr, setCr] = useState(() => { const m = D.rs.find(r => r.episode_id === e.id && r.user_id === me.id) || {}, o = {}; CRIT.forEach(([k]) => { if (m[k] != null) o[k] = +m[k]; }); return o; });
  const loadC = useCallback(async () => { const { data } = await sb.from('comments').select('id,text,spoiler,user_id,profiles(name)').eq('episode_id', e.id).order('created_at', { ascending: false }); setCm(data || []); }, [e.id]);
  useEffect(() => { loadC(); }, [loadC]);
  const adj = d => setSc(Math.max(0, Math.min(10, Math.round((sc + d) * 10) / 10)));
  const send = async () => { const { error } = await sb.from('ratings').upsert({ user_id: me.id, episode_id: e.id, score: sc, ...cr }); if (error) Alert.alert('Erro', error.message); D.reload(); };
  const post = async () => { if (!t.trim()) return; const { error } = await sb.from('comments').insert({ episode_id: e.id, text: t.trim(), spoiler: sp }); if (error) return Alert.alert('Erro', error.message); setT(''); setSp(false); loadC(); };
  const sc_ = D.rs.filter(r => r.episode_id === e.id).map(r => Math.round(+r.score)), mx = Math.max(1, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => sc_.filter(x => x === n).length));
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={[s.chip, { alignSelf: 'flex-start', marginBottom: 10 }]} onPress={back}><Text style={s.bt}>← Voltar</Text></TouchableOpacity>
      <View style={s.hero}>
        {!!e.image && <Image source={{ uri: e.image }} style={s.cover} />}
        <Text style={s.watermark}>{SUITS[(e.number - 1) % 4]}</Text>
        <Text style={s.heroS}>{lab(e)}</Text><Text style={s.heroT}>{e.title}</Text>
        <Text style={s.heroQ}>★ {f1(st.a)} · {st.n} avaliações{e.duration ? ' · ' + e.duration + ' min' : ''}</Text>
        {/^https?:\/\//i.test(e.link || '') && <TouchableOpacity style={[s.btn, { backgroundColor: '#000' }]} onPress={() => Linking.openURL(e.link)}><Text style={s.bt}>▶ ASSISTIR EPISÓDIO</Text></TouchableOpacity>}
        {canPost && <TouchableOpacity style={[s.btn, s.ghost]} onPress={() => Alert.alert('Excluir episódio?', '', [{ text: 'Cancelar' }, { text: 'Excluir', style: 'destructive', onPress: async () => { await sb.from('episodes').delete().eq('id', e.id); D.reload(); back(); } }])}><Text style={s.bt}>Excluir</Text></TouchableOpacity>}
      </View>
      {!!e.synopsis && <View style={s.card}><Text style={s.tag}>SINOPSE</Text><Text style={s.mut}>{e.synopsis}</Text></View>}
      {D.games.filter(g => g.episode_id === e.id).map(g => <View key={g.id} style={s.card}><Text style={s.tag}>JOGO DO EPISÓDIO</Text><Text style={s.h}>🃏 {g.card}</Text><Text style={s.mut}>{g.rules}</Text></View>)}
      <View style={[s.card, { alignItems: 'center' }]}>
        <Text style={s.tag}>SUA NOTA</Text><Text style={s.bigN}>{sc.toFixed(1)}</Text>
        <View style={s.row}>{[[-1, '−1'], [-0.1, '−0.1'], [0.1, '+0.1'], [1, '+1']].map(([d, l]) => <TouchableOpacity key={l} style={s.chip} onPress={() => adj(d)}><Text style={s.bt}>{l}</Text></TouchableOpacity>)}</View>
        <TouchableOpacity style={s.btn} onPress={send}><Text style={s.bt}>{st.mine != null ? 'Atualizar nota' : 'Enviar nota'}</Text></TouchableOpacity>
      </View>
      <View style={s.card}>
        <Text style={s.tag}>DISTRIBUIÇÃO</Text>
        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => { const c = sc_.filter(x => x === n).length; return <View key={n} style={s.line}><Text style={[s.mut, { width: 24 }]}>{n}</Text><View style={[s.hb, { width: (c / mx) * 200 }]} /><Text style={s.mut}> {c || ''}</Text></View>; })}
      </View>
      <View style={s.card}><Text style={s.tag}>NOTA POR CRITÉRIO (opcional)</Text>
        {CRIT.map(([k, l]) => <View key={k} style={s.line}><Text style={[s.bt, { width: 100 }]}>{l}</Text><TouchableOpacity style={s.chip} onPress={() => setCr({ ...cr, [k]: Math.max(0, (cr[k] ?? sc) - 0.5) })}><Text style={s.bt}>−</Text></TouchableOpacity><Text style={[s.bt, { width: 54, textAlign: 'center' }]}>{cr[k] != null ? cr[k].toFixed(1) : '–'}</Text><TouchableOpacity style={s.chip} onPress={() => setCr({ ...cr, [k]: Math.min(10, (cr[k] ?? sc) + 0.5) })}><Text style={s.bt}>+</Text></TouchableOpacity><Text style={s.mut}>  média {f1(avg(D.rs.filter(r => r.episode_id === e.id && r[k] != null).map(r => +r[k])))}</Text></View>)}
      </View>
      <Text style={s.sec}>COMENTÁRIOS</Text>
      <TextInput style={s.in} placeholder="Comente este episódio…" placeholderTextColor="#888" value={t} onChangeText={setT} maxLength={600} />
      <View style={s.row}>
        <TouchableOpacity style={[s.chip, sp && s.numOn]} onPress={() => setSp(!sp)}><Text style={s.bt}>⚠️ Spoiler</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, { marginTop: 0 }]} onPress={post}><Text style={s.bt}>Comentar</Text></TouchableOpacity>
      </View>
      {cm.map(c => (
        <TouchableOpacity key={c.id} style={[s.card, { marginTop: 10 }]} onPress={() => (st.mine != null ? setOp({ ...op, [c.id]: true }) : Alert.alert('Spoiler bloqueado', 'Avalie este episódio para liberar os spoilers.'))} onLongPress={() => Alert.alert('Comentário', '', [{ text: 'Denunciar', onPress: () => sb.from('reports').insert({ comment_id: c.id }).then(() => Alert.alert('Denúncia enviada')) }, ...((c.user_id === me.id || me.role === 'admin') ? [{ text: 'Apagar', style: 'destructive', onPress: () => del('comments', c.id, { reload: loadC }) }] : []), { text: 'Cancelar' }])}>
          <Text style={s.tag}>{c.profiles && c.profiles.name}</Text>
          <Text style={s.mut}>{c.spoiler && !op[c.id] ? '⚠️ Spoiler — toque para revelar' : c.text}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Graphs({ D, me, open }) {
  const seasons = [...new Set(D.eps.map(e => e.season))].sort((a, b) => a - b), [sel, setSel] = useState(null), cur = sel || seasons[0];
  const sAvg = n => avg(D.rs.filter(r => (D.eps.find(e => e.id === r.episode_id) || {}).season === n).map(r => +r.score));
  const all = D.rs.map(r => +r.score), sa = seasons.map(sAvg).filter(Boolean);
  const div = D.eps.map(e => ({ e, i: sInfo(D, e.id, me.id) })).filter(x => x.i.mine != null && x.i.n > 1).sort((x, y) => Math.abs(y.i.mine - y.i.a) - Math.abs(x.i.mine - x.i.a))[0];
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <View style={s.big}><Text style={s.heroS}>NOTA DA SÉRIE</Text><Text style={s.bigN}>{f1(avg(all))}</Text><Text style={s.heroQ}>média das temporadas: {f1(avg(sa))}</Text></View>
      <Text style={s.sec}>TEMPORADAS</Text>
      <Bars items={seasons.map(n => ({ k: n, label: 'T' + n, v: sAvg(n) }))} />
      <Text style={s.sec}>EPISÓDIOS: COMUNIDADE (vermelho) × VOCÊ (branco)</Text>
      <View style={s.row}>{seasons.map(n => <TouchableOpacity key={n} style={[s.chip, cur === n && s.numOn]} onPress={() => setSel(n)}><Text style={s.bt}>T{n}</Text></TouchableOpacity>)}</View>
      <Bars items={D.eps.filter(e => e.season === cur).map(e => { const i = sInfo(D, e.id, me.id); return { k: e.id, label: 'E' + e.number, v: i.a, v2: i.mine || 0, e }; })} onPress={i => open(i.e)} />
      {div && <View style={s.card}><Text style={s.tag}>SUA MAIOR DIVERGÊNCIA</Text><Text style={s.h}>{div.e.title}</Text><Text style={s.mut}>Você {div.i.mine.toFixed(1)} · Comunidade {f1(div.i.a)}</Text></View>}
    </ScrollView>
  );
}

function Frontier({ D, me, canPost }) {
  const [t, setT] = useState('ch');
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      <View style={s.row}>{[['ch', '👥 Personagens'], ['gm', '🃏 Jogos']].map(([k, l]) => <TouchableOpacity key={k} style={[s.chip, s.fl, t === k && s.numOn]} onPress={() => setT(k)}><Text style={s.bt}>{l}</Text></TouchableOpacity>)}</View>
      {t === 'ch' ? (
        <View style={{ marginTop: 12 }}>
          {canPost && <Form title="Novo personagem" fields={[{ k: 'name', p: 'Nome' }, { k: 'bio', p: 'Biografia', m: 1 }, { k: 'status', p: 'Status (vivo ou morto)' }]} onSave={v => (v.name ? add('characters', { name: v.name, bio: v.bio || '', status: (v.status || 'vivo').toLowerCase() }, D) : false)} />}
          {D.chars.length === 0 && <Text style={s.mut}>Nenhum personagem ainda.</Text>}
          {D.chars.map(c => <TouchableOpacity key={c.id} style={s.card} onLongPress={() => canPost && del('characters', c.id, D)}><Text style={s.glyph}>♠</Text><Text style={s.tag}>{c.status === 'morto' ? '🔴 MORTO' : '🟢 VIVO'}</Text><Text style={s.h}>{c.name}</Text><Text style={s.mut}>{c.bio}</Text><Rater D={D} me={me} kind="c" id={c.id} /></TouchableOpacity>)}
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          {canPost && <Form title="Novo jogo" fields={[{ k: 'card', p: 'Carta (ex.: 7♥)' }, { k: 'difficulty', p: 'Dificuldade 1 a 5', n: 1 }, { k: 'rules', p: 'Regras', m: 1 }, { k: 'result', p: 'Resultado' }]}
            extra={(v, setV) => <ScrollView horizontal style={{ marginBottom: 6 }}>{D.eps.map(e => <TouchableOpacity key={e.id} style={[s.chip, { marginRight: 6 }, v.ep === e.id && s.numOn]} onPress={() => setV({ ...v, ep: e.id })}><Text style={s.bt}>{lab(e)}</Text></TouchableOpacity>)}</ScrollView>}
            onSave={v => (v.card ? add('games', { card: v.card, suit: v.card.slice(-1), difficulty: +v.difficulty || 1, rules: v.rules || '', result: v.result || '', episode_id: v.ep || null }, D) : false)} />}
          {['♥', '♦', '♣', '♠'].map(su => (
            <View key={su}><Text style={s.sec}>{su} {{ '♥': 'COPAS', '♦': 'OUROS', '♣': 'PAUS', '♠': 'ESPADAS' }[su]}</Text>
              {D.games.filter(g => g.suit === su).map(g => <TouchableOpacity key={g.id} style={s.card} onLongPress={() => canPost && del('games', g.id, D)}><Text style={s.glyph}>{su}</Text><Text style={s.h}>{g.card} · {'★'.repeat(g.difficulty || 1)}</Text><Text style={s.mut}>{g.rules}</Text>{!!g.result && <Text style={s.tag}>{g.result}</Text>}<Rater D={D} me={me} kind="g" id={g.id} /></TouchableOpacity>)}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Profile({ D, me, isAdmin, refresh }) {
  const mine = D.rs.filter(r => r.user_id === me.id), col = { admin: RED, editor: '#d97706', member: '#2563eb', banned: '#555' }[me.role];
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <View style={[s.card, { alignItems: 'center' }]}>
        <View style={s.avatar}><Text style={s.avT}>{(me.name || '?')[0].toUpperCase()}</Text></View>
        <Text style={s.h}>{me.name}</Text>
        <View style={[s.pill, { backgroundColor: col }]}><Text style={s.bt}>{ROLES[me.role]}</Text></View>
        <View style={[s.row, { marginTop: 12 }]}><Stat n={f1(avg(mine.map(r => +r.score)))} l="minha média" /><Stat n={mine.length} l="avaliados" /></View>
        <TouchableOpacity style={[s.btn, s.ghost]} onPress={refresh}><Text style={s.bt}>↻ Atualizar meu cargo</Text></TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => sb.auth.signOut()}><Text style={s.bt}>Sair da conta</Text></TouchableOpacity>
      </View>
      <Text style={s.sec}>CONQUISTAS</Text>
      <View style={s.nums}>{[[mine.length >= 5, '📺 Maratonista'], [mine.length >= 10, '✍️ Crítico'], [D.eps.length > 0 && mine.length === D.eps.length, '🏁 Completista'], [D.xr.filter(x => x.user_id === me.id).length >= 3, '⚖️ Jurado']].map(([ok, l]) => <View key={l} style={[s.chip, ok ? s.numOn : { opacity: 0.35 }, { marginRight: 6, marginBottom: 6 }]}><Text style={s.bt}>{l}</Text></View>)}</View>
      <TouchableOpacity style={s.btn} onPress={() => { const f = [...mine].sort((a, b) => b.score - a.score)[0], fe = f && D.eps.find(x => x.id === f.episode_id); Share.share({ message: '🃏 Meu Wrapped — Alice in Borderland: Rafael Bondim\nAvaliei ' + mine.length + ' episódios\nMinha média: ' + f1(avg(mine.map(r => +r.score))) + '\nFavorito: ' + (fe ? fe.title + ' (' + (+f.score).toFixed(1) + ')' : '–') }); }}><Text style={s.bt}>📤 Compartilhar meu Wrapped</Text></TouchableOpacity>
      <Text style={s.sec}>MINHAS NOTAS</Text>
      {mine.map(r => { const e = D.eps.find(x => x.id === r.episode_id); return e ? <View key={e.id} style={s.line}><Text style={s.bt}>{lab(e)}  </Text><Text style={s.mut}>{e.title}  ★ {(+r.score).toFixed(1)}</Text></View> : null; })}
      {isAdmin && <><Text style={s.sec}>PAINEL</Text>
        <View style={s.row}><Stat n={D.rs.length} l="avaliações" /><Stat n={D.rs.reduce((t, r) => t + +r.score, 0).toFixed(1)} l="soma" /><Stat n={f1(avg(D.rs.map(r => +r.score)))} l="média" /></View>
        <Text style={s.sec}>DENÚNCIAS</Text><Reports /><Text style={s.sec}>CARGOS</Text><Admin /></>}
    </ScrollView>
  );
}

function Rater({ D, me, kind, id }) {
  const l = D.xr.filter(r => r.kind === kind && r.ref_id === id), m = l.find(r => r.user_id === me.id);
  const vote = async n => { const { error } = await sb.from('xr').upsert({ user_id: me.id, kind, ref_id: id, score: n }); if (error) Alert.alert('Erro', error.message); D.reload(); };
  return (
    <View>
      <Text style={s.mut}>★ {f1(avg(l.map(r => +r.score)))} ({l.length}){m ? ' · sua nota ' + m.score : ''}</Text>
      <View style={s.nums}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <TouchableOpacity key={n} style={[s.num, { width: '9%', paddingVertical: 6 }, m && +m.score === n && s.numOn]} onPress={() => vote(n)}><Text style={s.bt}>{n}</Text></TouchableOpacity>)}</View>
    </View>
  );
}

function Results({ q, D, open }) {
  const m = x => (x || '').toLowerCase().includes(q.toLowerCase());
  return (
    <View>
      {D.eps.filter(e => m(e.title) || m(lab(e)) || m(e.synopsis)).map(e => <TouchableOpacity key={'e' + e.id} style={s.card} onPress={() => open(e)}><Text style={s.tag}>EPISÓDIO · {lab(e)}</Text><Text style={s.h}>{e.title}</Text></TouchableOpacity>)}
      {D.chars.filter(c => m(c.name) || m(c.bio)).map(c => <View key={'c' + c.id} style={s.card}><Text style={s.tag}>PERSONAGEM</Text><Text style={s.h}>{c.name}</Text><Text style={s.mut}>{c.bio}</Text></View>)}
      {D.games.filter(g => m(g.card) || m(g.rules)).map(g => <View key={'g' + g.id} style={s.card}><Text style={s.tag}>JOGO</Text><Text style={s.h}>{g.card}</Text><Text style={s.mut}>{g.rules}</Text></View>)}
    </View>
  );
}

function Ranks({ D }) {
  const [t, setT] = useState('ep');
  const xa = (k, id) => avg(D.xr.filter(r => r.kind === k && r.ref_id === id).map(r => +r.score));
  const eps = D.eps.map(e => ({ k: e.id, n: e.title, sub: lab(e), a: avg(D.rs.filter(r => r.episode_id === e.id).map(r => +r.score)) })).filter(x => x.a);
  const ch = D.chars.map(c => ({ k: c.id, n: c.name, sub: c.status, a: xa('c', c.id) })).filter(x => x.a);
  const gm = D.games.map(g => ({ k: g.id, n: g.card, sub: g.suit, a: xa('g', g.id) })).filter(x => x.a);
  const ss = [...new Set(D.eps.map(e => e.season))].map(n => ({ k: n, n: 'Temporada ' + n, sub: '', a: avg(D.rs.filter(r => (D.eps.find(e => e.id === r.episode_id) || {}).season === n).map(r => +r.score)) })).filter(x => x.a);
  const top = a => [...a].sort((x, y) => y.a - x.a), list = top({ ep: eps, ch, gm, ss }[t] || []);
  const sorted = top(eps), allR = D.rs.map(r => +r.score);
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={s.row}>{[['ep', 'Episódios'], ['ch', 'Personagens'], ['gm', 'Jogos'], ['ss', 'Temporadas'], ['st', 'Estatísticas']].map(([k, l]) => <TouchableOpacity key={k} style={[s.chip, { marginRight: 6 }, t === k && s.numOn]} onPress={() => setT(k)}><Text style={s.bt}>{l}</Text></TouchableOpacity>)}</View></ScrollView>
      {t === 'st' ? (
        <View style={{ marginTop: 12 }}>
          <View style={s.row}><Stat n={D.eps.length} l="episódios" /><Stat n={D.chars.length} l="personagens" /><Stat n={D.games.length} l="jogos" /></View>
          <View style={s.row}><Stat n={D.chars.filter(c => c.status === 'morto').length} l="mortes" /><Stat n={f1(avg(allR))} l="nota média" /><Stat n={allR.length} l="notas" /></View>
          {sorted[0] && <View style={s.card}><Text style={s.tag}>MAIOR NOTA</Text><Text style={s.h}>{sorted[0].sub} · {sorted[0].n}</Text><Text style={s.mut}>★ {f1(sorted[0].a)}</Text></View>}
          {sorted.length > 1 && <View style={s.card}><Text style={s.tag}>MENOR NOTA</Text><Text style={s.h}>{sorted[sorted.length - 1].sub} · {sorted[sorted.length - 1].n}</Text><Text style={s.mut}>★ {f1(sorted[sorted.length - 1].a)}</Text></View>}
          {top(ch)[0] && <View style={s.card}><Text style={s.tag}>PERSONAGEM MAIS POPULAR</Text><Text style={s.h}>{top(ch)[0].n}</Text></View>}
          {top(gm)[0] && <View style={s.card}><Text style={s.tag}>JOGO MAIS BEM AVALIADO</Text><Text style={s.h}>{top(gm)[0].n}</Text></View>}
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          {list.length === 0 && <Text style={s.mut}>Ainda sem notas para este ranking.</Text>}
          {list.map((x, i) => <View key={x.k} style={s.card}><Text style={s.glyph}>{i + 1}</Text><Text style={s.h}>{i + 1}. {x.n}</Text><Text style={s.mut}>{x.sub} · ★ {f1(x.a)}</Text></View>)}
          {t === 'gm' && SUITS.map(su => { const b = top(gm.filter(g => g.sub === su))[0]; return b ? <Text key={su} style={s.mut}>Melhor {su}: {b.n} (★ {f1(b.a)})</Text> : null; })}
        </View>
      )}
    </ScrollView>
  );
}

function Community({ me, isAdmin }) {
  const [t, setT] = useState('chat');
  return (
    <View style={{ flex: 1 }}>
      <View style={[s.row, { padding: 10 }]}>{[['chat', '💬 Chat'], ['th', '🧠 Teorias']].map(([k, l]) => <TouchableOpacity key={k} style={[s.chip, s.fl, t === k && s.numOn]} onPress={() => setT(k)}><Text style={s.bt}>{l}</Text></TouchableOpacity>)}</View>
      {t === 'chat' ? <Chat me={me} isAdmin={isAdmin} /> : <Theories me={me} isAdmin={isAdmin} />}
    </View>
  );
}

function Theories({ me, isAdmin }) {
  const [th, setTh] = useState([]), [lk, setLk] = useState([]), [t, setT] = useState(''), [tp, setTp] = useState('Teoria'), [sp, setSp] = useState(false), [f, setF] = useState('Todos'), [op, setOp] = useState({});
  const load = useCallback(async () => { const a = await sb.from('theories').select('id,text,topic,spoiler,user_id,profiles(name)').order('created_at', { ascending: false }); const b = await sb.from('likes').select('*'); setTh(a.data || []); setLk(b.data || []); }, []);
  useEffect(() => { load(); }, [load]);
  const post = async () => { if (!t.trim()) return; const { error } = await sb.from('theories').insert({ text: t.trim(), topic: tp, spoiler: sp }); if (error) return Alert.alert('Erro', error.message); setT(''); setSp(false); load(); };
  const like = async id => { if (lk.find(l => l.theory_id === id && l.user_id === me.id)) await sb.from('likes').delete().eq('theory_id', id).eq('user_id', me.id); else await sb.from('likes').insert({ theory_id: id }); load(); };
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      <TextInput style={s.in} placeholder="Poste uma teoria ou opinião…" placeholderTextColor="#888" value={t} onChangeText={setT} multiline />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>{TOPICS.map(x => <TouchableOpacity key={x} style={[s.chip, { marginRight: 6 }, tp === x && s.numOn]} onPress={() => setTp(x)}><Text style={s.bt}>{x}</Text></TouchableOpacity>)}</ScrollView>
      <View style={s.row}><TouchableOpacity style={[s.chip, { marginTop: 8 }, sp && s.numOn]} onPress={() => setSp(!sp)}><Text style={s.bt}>⚠️ Spoiler</Text></TouchableOpacity><TouchableOpacity style={[s.btn, s.fl]} onPress={post}><Text style={s.bt}>Publicar</Text></TouchableOpacity></View>
      <Text style={s.sec}>FILTRAR</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>{['Todos', ...TOPICS].map(x => <TouchableOpacity key={x} style={[s.chip, { marginRight: 6 }, f === x && s.numOn]} onPress={() => setF(x)}><Text style={s.bt}>{x}</Text></TouchableOpacity>)}</ScrollView>
      {th.filter(x => f === 'Todos' || x.topic === f).map(x => {
        const n = lk.filter(l => l.theory_id === x.id).length, mine = lk.some(l => l.theory_id === x.id && l.user_id === me.id);
        return (
          <TouchableOpacity key={x.id} style={[s.card, { marginTop: 10 }]} onPress={() => setOp({ ...op, [x.id]: true })} onLongPress={() => (x.user_id === me.id || isAdmin) && del('theories', x.id, { reload: load })}>
            <Text style={s.tag}>{x.topic.toUpperCase()} · {x.profiles && x.profiles.name}</Text>
            <Text style={s.h}>{x.spoiler && !op[x.id] ? '⚠️ Spoiler — toque para revelar' : x.text}</Text>
            <TouchableOpacity style={[s.chip, { alignSelf: 'flex-start' }, mine && s.numOn]} onPress={() => like(x.id)}><Text style={s.bt}>👍 {n}</Text></TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function Reports() {
  const [r, setR] = useState([]);
  const load = useCallback(async () => { const { data } = await sb.from('reports').select('id,comment_id,comments(text)').order('id', { ascending: false }); setR(data || []); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <View>
      {r.length === 0 && <Text style={s.mut}>Nenhuma denúncia.</Text>}
      {r.map(x => (
        <View key={x.id} style={s.card}>
          <Text style={s.mut}>{x.comments ? x.comments.text : '(comentário já apagado)'}</Text>
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, s.fl]} onPress={async () => { await sb.from('comments').delete().eq('id', x.comment_id); await sb.from('reports').delete().eq('id', x.id); load(); }}><Text style={s.bt}>Apagar</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.ghost, s.fl]} onPress={async () => { await sb.from('reports').delete().eq('id', x.id); load(); }}><Text style={s.bt}>Dispensar</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}


export default function App() {
  const [session, setSession] = useState(undefined), [me, setMe] = useState(null), [tab, setTab] = useState('hm'), [ep, setEp] = useState(null);
  const [D, setD] = useState({ eps: [], rs: [], chars: [], games: [], xr: [] });
  const loadMe = useCallback(async () => {
    const { data: u } = await sb.auth.getUser();
    if (!u || !u.user) return;
    const { data } = await sb.from('profiles').select('*').eq('id', u.user.id).single();
    setMe(data);
  }, []);
  const reload = useCallback(async () => {
    const [a, b, c, d, x] = await Promise.all([sb.from('episodes').select('*').order('season').order('number'), sb.from('ratings').select('*'), sb.from('characters').select('*').order('name'), sb.from('games').select('*').order('id'), sb.from('xr').select('*')]);
    setD({ eps: a.data || [], rs: b.data || [], chars: c.data || [], games: d.data || [], xr: x.data || [] });
  }, []);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, sess) => setSession(sess));
    const ap = AppState.addEventListener('change', st => st === 'active' && loadMe());
    return () => { data.subscription.unsubscribe(); ap.remove(); };
  }, [loadMe]);
  useEffect(() => { if (!session) setMe(null); else loadMe(); }, [session, loadMe]);
  useEffect(() => { if (me) reload(); }, [me && me.id, reload]);

  if (session === undefined || (session && !me)) return <View style={[s.root, { justifyContent: 'center' }]}><ActivityIndicator color={RED} size="large" /></View>;
  if (!session) return <SafeAreaView style={s.root}><StatusBar barStyle="light-content" /><Auth /></SafeAreaView>;

  const isAdmin = me.role === 'admin', canPost = isAdmin || me.role === 'editor', data = { ...D, reload };
  const tabs = [['hm', '⌂', 'Início'], ['ep', '♠', 'Episódios'], ['gr', '♦', 'Gráficos'], ['rk', '★', 'Rankings'], ['fr', '♣', 'Fronteira'], ['ch', '♥', 'Comunidade'], ['pf', '☻', 'Perfil']];
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />
      <Title />
      {me.role === 'banned' && <Text style={s.ban}>Sua conta está suspensa: você só pode ler.</Text>}
      <Fade key={tab + (ep ? ep.id : '')}>
        {ep ? <EpisodeView e={ep} D={data} me={me} canPost={canPost} back={() => setEp(null)} /> : (
          <>
            {tab === 'hm' && <Home D={data} me={me} open={setEp} />}
            {tab === 'ep' && <Episodes D={data} me={me} canPost={canPost} open={setEp} />}
            {tab === 'gr' && <Graphs D={data} me={me} open={setEp} />}
            {tab === 'fr' && <Frontier D={data} me={me} canPost={canPost} />}
            {tab === 'rk' && <Ranks D={data} />}
            {tab === 'ch' && <Community me={me} isAdmin={isAdmin} />}
            {tab === 'pf' && <Profile D={data} me={me} isAdmin={isAdmin} refresh={loadMe} />}
          </>
        )}
      </Fade>
      <View style={s.nav}>
        {tabs.map(([k, g, l]) => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => { setEp(null); setTab(k); }}>
            <Text style={[s.tg, tab === k && { color: '#fff' }]}>{g}</Text>
            {tab === k && <Text style={s.tt}>{l}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  head: { backgroundColor: RED, alignItems: 'center', paddingVertical: 10, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  suits: { color: '#fff', fontSize: 13, letterSpacing: 10, opacity: 0.85 },
  logo: { color: '#fff', fontSize: 28, fontWeight: '800', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontStyle: 'italic' },
  by: { color: '#fff', fontSize: 11, opacity: 0.9 },
  in: { backgroundColor: '#141414', color: '#fff', borderRadius: 14, padding: 13, marginBottom: 10, fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  btn: { backgroundColor: RED, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginTop: 10, alignItems: 'center' },
  fl: { flex: 1, marginHorizontal: 4 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555' },
  bt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { color: '#fff', textAlign: 'center', marginTop: 16, textDecorationLine: 'underline' },
  card: { backgroundColor: '#141414', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#262626', overflow: 'hidden' },
  glyph: { position: 'absolute', right: 12, top: -8, fontSize: 78, color: RED, opacity: 0.2 },
  h: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  tag: { color: RED, fontWeight: '800', fontSize: 12, letterSpacing: 1.5, marginBottom: 2 },
  mut: { color: '#a8a8a8', fontSize: 14, marginBottom: 4 },
  hero: { backgroundColor: RED, borderRadius: 26, padding: 22, marginBottom: 12, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -8, top: -34, fontSize: 190, color: '#000', opacity: 0.35 },
  watermark2: { fontSize: 140, color: '#333', marginVertical: 20 },
  heroS: { color: '#fff', fontSize: 12, letterSpacing: 3, fontWeight: '700' },
  heroT: { color: '#fff', fontSize: 42, fontWeight: '900', marginVertical: 2 },
  heroQ: { color: '#fff', fontSize: 15, fontStyle: 'italic', opacity: 0.95 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  stat: { flex: 1, backgroundColor: '#141414', borderRadius: 18, borderWidth: 1, borderColor: '#262626', alignItems: 'center', paddingVertical: 14, marginBottom: 8 },
  statN: { color: '#fff', fontSize: 28, fontWeight: '900' },
  big: { alignItems: 'center', backgroundColor: RED, borderRadius: 24, padding: 18, marginBottom: 14 },
  bigN: { color: '#fff', fontSize: 64, fontWeight: '900' },
  nums: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  num: { width: '18%', backgroundColor: '#000', borderWidth: 1, borderColor: '#333', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  numOn: { backgroundColor: RED, borderColor: RED },
  chip: { backgroundColor: '#000', borderWidth: 1, borderColor: '#333', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  pill: { borderRadius: 99, paddingVertical: 4, paddingHorizontal: 14, marginTop: 4 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avT: { color: '#fff', fontSize: 38, fontWeight: '900' },
  bub: { backgroundColor: '#1b1b1b', borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14, maxWidth: '85%' },
  send: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#222' },
  ban: { backgroundColor: '#400', color: '#fff', textAlign: 'center', padding: 8 },
  play: { width: 240, backgroundColor: '#fff', borderRadius: 20, padding: 18, alignItems: 'center', marginBottom: 10 },
  rank: { alignSelf: 'flex-start', color: '#000', fontSize: 34, fontWeight: '900' },
  bigSuit: { color: '#000', fontSize: 96 },
  playT: { color: '#000', fontSize: 18, fontWeight: '800' },
  playM: { color: '#444', fontSize: 13, textAlign: 'center', marginTop: 4 },
  nav: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 30, margin: 10, padding: 6, borderWidth: 1, borderColor: '#2a2a2a' },
  tab: { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  tabOn: { flex: 2.4, backgroundColor: RED },
  tg: { color: '#888', fontSize: 20, fontWeight: '700' },
  tt: { color: '#fff', fontWeight: '800', fontSize: 12, marginLeft: 5 },
  bars: { flexDirection: 'row', gap: 14, paddingVertical: 8, paddingHorizontal: 4 },
  barC: { alignItems: 'center' },
  bar: { width: 14, backgroundColor: RED, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  bar2: { backgroundColor: '#fff', marginLeft: 3 },
  hb: { height: 8, backgroundColor: RED, borderRadius: 4, marginLeft: 8 },
  sec: { color: '#fff', fontSize: 13, letterSpacing: 2, fontWeight: '800', marginVertical: 10 },
  cover: { width: '100%', height: 150, borderRadius: 14, marginBottom: 10 },
  line: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
});
