import 'react-native-url-polyfill/auto';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Linking, Alert, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
const RED = '#c40000';
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
    <ScrollView contentContainerStyle={{ padding: 14 }}>
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
    </ScrollView>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined), [me, setMe] = useState(null), [tab, setTab] = useState('ep');
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return setMe(null);
    sb.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => setMe(data));
  }, [session]);

  if (session === undefined) return <View style={[s.root, { justifyContent: 'center' }]}><ActivityIndicator color={RED} size="large" /></View>;
  if (!session) return <SafeAreaView style={s.root}><StatusBar barStyle="light-content" /><Auth /></SafeAreaView>;
  if (!me) return <View style={[s.root, { justifyContent: 'center' }]}><ActivityIndicator color={RED} size="large" /></View>;

  const isAdmin = me.role === 'admin', canPost = isAdmin || me.role === 'editor';
  const tabs = [['ep', '♠ Episódios'], ['nt', '♦ Notas'], ['ch', '♥ Chat'], ...(isAdmin ? [['ad', '♣ Cargos']] : [])];
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />
      <Title />
      {me.role === 'banned' && <Text style={s.ban}>Sua conta está suspensa: você só pode ler.</Text>}
      <View style={{ flex: 1 }}>
        {tab === 'ep' && <Episodes canPost={canPost} />}
        {tab === 'nt' && <Ratings me={me} />}
        {tab === 'ch' && <Chat me={me} isAdmin={isAdmin} />}
        {tab === 'ad' && isAdmin && <Admin />}
      </View>
      <View style={s.nav}>
        {tabs.map(([k, l]) => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => setTab(k)}><Text style={[s.tt, tab === k && { color: '#fff' }]}>{l}</Text></TouchableOpacity>
        ))}
        <TouchableOpacity style={s.tab} onPress={() => sb.auth.signOut()}><Text style={s.tt}>Sair</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  head: { backgroundColor: RED, alignItems: 'center', paddingVertical: 14 },
  suits: { color: '#fff', fontSize: 16, letterSpacing: 8 },
  logo: { color: '#fff', fontSize: 30, fontWeight: '800', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontStyle: 'italic' },
  by: { color: '#fff', fontSize: 12, marginTop: 2 },
  in: { backgroundColor: '#161616', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 16, borderWidth: 1, borderColor: '#2c2c2c' },
  btn: { backgroundColor: RED, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, marginTop: 8, alignItems: 'center' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555' },
  bt: { color: '#fff', fontWeight: '600', fontSize: 15 },
  link: { color: '#fff', textAlign: 'center', marginTop: 16, textDecorationLine: 'underline' },
  card: { backgroundColor: '#161616', borderLeftWidth: 5, borderLeftColor: RED, borderRadius: 10, padding: 14, marginBottom: 12 },
  h: { color: '#fff', fontSize: 19, fontWeight: '700', marginBottom: 4 },
  tag: { color: RED, fontWeight: '700', fontSize: 13 },
  mut: { color: '#a0a0a0', fontSize: 14, marginBottom: 4 },
  big: { alignItems: 'center', backgroundColor: '#000', borderWidth: 2, borderColor: RED, borderRadius: 12, padding: 16, marginBottom: 14 },
  bigN: { color: RED, fontSize: 56, fontWeight: '800' },
  nums: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  num: { width: '18%', backgroundColor: '#000', borderWidth: 1, borderColor: '#2c2c2c', borderRadius: 6, paddingVertical: 9, alignItems: 'center' },
  numOn: { backgroundColor: RED, borderColor: RED },
  chip: { backgroundColor: '#000', borderWidth: 1, borderColor: '#2c2c2c', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  bub: { backgroundColor: '#161616', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, maxWidth: '85%', borderWidth: 1, borderColor: '#2c2c2c' },
  send: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#2c2c2c' },
  ban: { backgroundColor: '#400', color: '#fff', textAlign: 'center', padding: 8 },
  nav: { flexDirection: 'row', backgroundColor: '#000', borderTopWidth: 3, borderTopColor: RED },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabOn: { backgroundColor: '#1a0000' },
  tt: { color: '#aaa', fontWeight: '600', fontSize: 12 },
});
