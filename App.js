import 'react-native-url-polyfill/auto';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, Animated, AppState, FlatList, ScrollView, Linking, Alert, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
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
    <Text style={s.by}>Fã-site · por Rafael Bondim</Text>
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

function Episodes({ canPost }) {
  const [eps, setEps] = useState([]), [f, setF] = useState({ season: '', number: '', title: '', synopsis: '', link: '' });
  const load = useCallback(async () => { const { data } = await sb.from('episodes').select('*').order('season').order('number'); setEps(data || []); }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!f.season || !f.number || !f.title) return Alert.alert('Preencha temporada, episódio e título.');
    const { error } = await sb.from('episodes').insert({ season: +f.season, number: +f.number, title: f.title, synopsis: f.synopsis, link: f.link });
    if (error) return Alert.alert('Erro', error.message);
    setF({ season: '', number: '', title: '', synopsis: '', link: '' }); load();
  };
  const del = id => Alert.alert('Excluir episódio?', '', [{ text: 'Cancelar' }, { text: 'Excluir', style: 'destructive', onPress: async () => { await sb.from('episodes').delete().eq('id', id); load(); } }]);
  const set = k => v => setF({ ...f, [k]: v });
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      {canPost && (
        <View style={s.card}>
          <Text style={s.h}>♣ Postar episódio</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[s.in, { flex: 1 }]} placeholder="Temporada" placeholderTextColor="#888" keyboardType="number-pad" value={f.season} onChangeText={set('season')} />
            <TextInput style={[s.in, { flex: 1 }]} placeholder="Episódio" placeholderTextColor="#888" keyboardType="number-pad" value={f.number} onChangeText={set('number')} />
          </View>
          <TextInput style={s.in} placeholder="Título" placeholderTextColor="#888" value={f.title} onChangeText={set('title')} />
          <TextInput style={[s.in, { height: 80 }]} multiline placeholder="Sinopse" placeholderTextColor="#888" value={f.synopsis} onChangeText={set('synopsis')} />
          <TextInput style={s.in} placeholder="Link oficial (opcional)" placeholderTextColor="#888" autoCapitalize="none" value={f.link} onChangeText={set('link')} />
          <TouchableOpacity style={s.btn} onPress={add}><Text style={s.bt}>Publicar episódio</Text></TouchableOpacity>
        </View>
      )}
      {eps.length === 0 && <Text style={s.mut}>Nenhum episódio postado ainda.</Text>}
      {eps.map(e => (
        <View key={e.id} style={s.card}>
          <Text style={s.glyph}>{SUITS[(e.number - 1) % 4]}</Text>
          <Text style={s.tag}>T{e.season} · EP {e.number}</Text>
          <Text style={s.h}>{e.title}</Text>
          {!!e.synopsis && <Text style={s.mut}>{e.synopsis}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/^https?:\/\//i.test(e.link || '') && <TouchableOpacity style={s.btn} onPress={() => Linking.openURL(e.link)}><Text style={s.bt}>▶ Ver episódio</Text></TouchableOpacity>}
            {canPost && <TouchableOpacity style={[s.btn, s.ghost]} onPress={() => del(e.id)}><Text style={s.bt}>Excluir</Text></TouchableOpacity>}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Ratings({ me }) {
  const [eps, setEps] = useState([]), [rs, setRs] = useState([]);
  const load = useCallback(async () => {
    const a = await sb.from('episodes').select('*').order('season').order('number');
    const b = await sb.from('ratings').select('*');
    setEps(a.data || []); setRs(b.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const vote = async (episode_id, score) => {
    const { error } = await sb.from('ratings').upsert({ user_id: me.id, episode_id, score });
    if (error) Alert.alert('Não foi possível salvar', error.message);
    load();
  };
  const avg = a => (a.length ? (a.reduce((t, x) => t + x, 0) / a.length).toFixed(1) : '–');
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <View style={s.big}><Text style={s.mut}>NOTA GERAL DA SÉRIE</Text><Text style={s.bigN}>{avg(rs.map(r => r.score))}</Text><Text style={s.mut}>{rs.length} avaliações</Text></View>
      {eps.map(e => {
        const list = rs.filter(r => r.episode_id === e.id), mine = list.find(r => r.user_id === me.id);
        return (
          <View key={e.id} style={s.card}>
            <Text style={s.tag}>T{e.season} · EP {e.number}  —  média {avg(list.map(r => r.score))} ({list.length})</Text>
            <Text style={s.h}>{e.title}</Text>
            <View style={s.nums}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <TouchableOpacity key={n} style={[s.num, mine?.score === n && s.numOn]} onPress={() => vote(e.id, n)}><Text style={s.bt}>{n}</Text></TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}
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

const SUITS = ['♠', '♦', '♣', '♥'];
const MISS = {
  '♠': ['Jogo de força', 'Corra, escale, sobreviva. Só o corpo decide.'],
  '♦': ['Jogo de intelecto', 'Resolva o enigma antes do tempo acabar.'],
  '♣': ['Jogo de equipe', 'Ninguém vence sozinho. Escolha em quem confiar.'],
  '♥': ['Jogo psicológico', 'Quem você trairia para continuar vivo?'],
};
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const QUIPS = ['Todo jogo tem um furo. Ache o seu.', 'Confie em ninguém. Questione tudo.', 'A melhor estratégia é mudar as regras.', 'Debater é o único jogo que vale a pena.'];
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

const Stat = ({ n, l }) => <View style={s.stat}><Text style={s.statN}>{n}</Text><Text style={s.mut}>{l}</Text></View>;

function Home({ me, go }) {
  const [d, setD] = useState({ eps: [], rs: [], last: null });
  const [q] = useState(QUIPS[Math.floor(Math.random() * QUIPS.length)]);
  useEffect(() => {
    (async () => {
      const a = await sb.from('episodes').select('*').order('season').order('number');
      const b = await sb.from('ratings').select('*');
      const c = await sb.from('messages').select('text,profiles(name)').order('created_at', { ascending: false }).limit(1);
      setD({ eps: a.data || [], rs: b.data || [], last: c.data && c.data[0] });
    })();
  }, []);
  const sc = d.rs.map(r => r.score), avg = sc.length ? (sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(1) : '–';
  const best = d.eps.map(e => { const l = d.rs.filter(r => r.episode_id === e.id); return { e, a: l.length ? l.reduce((t, r) => t + r.score, 0) / l.length : 0 }; }).sort((x, y) => y.a - x.a)[0];
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <View style={s.hero}>
        <Text style={s.watermark}>♠</Text>
        <Text style={s.heroS}>BEM-VINDO AO JOGO</Text>
        <Text style={s.heroT}>{(me.name || 'Jogador').split(' ')[0]}.</Text>
        <Text style={s.heroQ}>{q}</Text>
      </View>
      <View style={s.row}><Stat n={avg} l="nota geral" /><Stat n={d.eps.length} l="episódios" /><Stat n={sc.length} l="votos" /></View>
      {best && best.a > 0 && <View style={s.card}><Text style={s.glyph}>♦</Text><Text style={s.tag}>MELHOR EPISÓDIO</Text><Text style={s.h}>{best.e.title}</Text><Text style={s.mut}>T{best.e.season} · EP {best.e.number} · média {best.a.toFixed(1)}</Text></View>}
      {d.last && <View style={s.card}><Text style={s.glyph}>♥</Text><Text style={s.tag}>ÚLTIMA NO CHAT</Text><Text style={s.h}>{d.last.text}</Text><Text style={s.mut}>{d.last.profiles && d.last.profiles.name}</Text></View>}
      <View style={s.row}>
        <TouchableOpacity style={[s.btn, s.fl]} onPress={() => go('ep')}><Text style={s.bt}>♠ Episódios</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.fl]} onPress={() => go('ch')}><Text style={s.bt}>♥ Chat</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.fl]} onPress={() => go('cd')}><Text style={s.bt}>♣ Carta</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Cards() {
  const [c, setC] = useState(null);
  const flip = useRef(new Animated.Value(0)).current;
  const draw = () => {
    flip.setValue(0);
    setC({ suit: SUITS[Math.floor(Math.random() * 4)], r: RANKS[Math.floor(Math.random() * RANKS.length)], chance: Math.floor(Math.random() * 70) + 10 });
    Animated.spring(flip, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };
  const red = c && (c.suit === '♦' || c.suit === '♥');
  return (
    <ScrollView contentContainerStyle={{ padding: 14, alignItems: 'center' }}>
      <Text style={s.h}>Sorteie sua carta</Text>
      <Text style={[s.mut, { textAlign: 'center', marginBottom: 14 }]}>Cada naipe é um tipo de jogo em Borderland. Qual será o seu?</Text>
      {c ? (
        <Animated.View style={[s.play, { transform: [{ rotate: flip.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] }) }, { scale: flip }] }]}>
          <Text style={[s.rank, red && { color: RED }]}>{c.r}</Text>
          <Text style={[s.bigSuit, red && { color: RED }]}>{c.suit}</Text>
          <Text style={s.playT}>{MISS[c.suit][0]}</Text>
          <Text style={s.playM}>{MISS[c.suit][1]}</Text>
          <Text style={s.playM}>Chance de sobreviver: {c.chance}%</Text>
        </Animated.View>
      ) : <Text style={s.watermark2}>🂡</Text>}
      <TouchableOpacity style={[s.btn, { paddingHorizontal: 30 }]} onPress={draw}><Text style={s.bt}>{c ? 'Sortear de novo' : 'Virar carta'}</Text></TouchableOpacity>
    </ScrollView>
  );
}

function Profile({ me, isAdmin, refresh }) {
  const col = { admin: RED, editor: '#d97706', member: '#2563eb', banned: '#555' }[me.role];
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <View style={[s.card, { alignItems: 'center' }]}>
        <View style={s.avatar}><Text style={s.avT}>{(me.name || '?')[0].toUpperCase()}</Text></View>
        <Text style={s.h}>{me.name}</Text>
        <View style={[s.pill, { backgroundColor: col }]}><Text style={s.bt}>{ROLES[me.role]}</Text></View>
        {!isAdmin && <Text style={[s.mut, { textAlign: 'center', marginTop: 10 }]}>Para virar admin, defina o cargo no Supabase e toque em Atualizar.</Text>}
        <TouchableOpacity style={[s.btn, s.ghost]} onPress={refresh}><Text style={s.bt}>↻ Atualizar meu cargo</Text></TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => sb.auth.signOut()}><Text style={s.bt}>Sair da conta</Text></TouchableOpacity>
      </View>
      {isAdmin && <><Text style={s.h}>♣ Cargos</Text><Admin /></>}
    </ScrollView>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined), [me, setMe] = useState(null), [tab, setTab] = useState('hm');
  const loadMe = useCallback(async () => {
    const { data: u } = await sb.auth.getUser();
    if (!u || !u.user) return;
    const { data } = await sb.from('profiles').select('*').eq('id', u.user.id).single();
    setMe(data);
  }, []);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, sess) => setSession(sess));
    const ap = AppState.addEventListener('change', st => st === 'active' && loadMe());
    return () => { data.subscription.unsubscribe(); ap.remove(); };
  }, [loadMe]);
  useEffect(() => { if (!session) setMe(null); else loadMe(); }, [session, loadMe]);

  if (session === undefined) return <View style={[s.root, { justifyContent: 'center' }]}><ActivityIndicator color={RED} size="large" /></View>;
  if (!session) return <SafeAreaView style={s.root}><StatusBar barStyle="light-content" /><Auth /></SafeAreaView>;
  if (!me) return <View style={[s.root, { justifyContent: 'center' }]}><ActivityIndicator color={RED} size="large" /></View>;

  const isAdmin = me.role === 'admin', canPost = isAdmin || me.role === 'editor';
  const tabs = [['hm', '⌂', 'Início'], ['ep', '♠', 'Episódios'], ['nt', '♦', 'Notas'], ['ch', '♥', 'Chat'], ['cd', '♣', 'Cartas'], ['pf', '☻', 'Perfil']];
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />
      <Title />
      {me.role === 'banned' && <Text style={s.ban}>Sua conta está suspensa: você só pode ler.</Text>}
      <Fade key={tab}>
        {tab === 'hm' && <Home me={me} go={setTab} />}
        {tab === 'ep' && <Episodes canPost={canPost} />}
        {tab === 'nt' && <Ratings me={me} />}
        {tab === 'ch' && <Chat me={me} isAdmin={isAdmin} />}
        {tab === 'cd' && <Cards />}
        {tab === 'pf' && <Profile me={me} isAdmin={isAdmin} refresh={loadMe} />}
      </Fade>
      <View style={s.nav}>
        {tabs.map(([k, g, l]) => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => setTab(k)}>
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
});
