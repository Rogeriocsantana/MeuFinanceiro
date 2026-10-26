import React, { useEffect, useState } from 'react';
import { AppState, Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { addEntry, backupState, Entry, listEntries } from '../data/database';
import { backupToDrive, connectDrive } from '../services/drive';
import * as SecureStore from '../services/secrets';
const money = (cents: number) => (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function App() {
  const [entries,setEntries] = useState<Entry[]>([]), [description,setDescription] = useState(''), [amount,setAmount] = useState('');
  const [password,setPassword] = useState(''), [drive,setDrive] = useState(false), [busy,setBusy] = useState(false), [pending,setPending] = useState(false), [message,setMessage] = useState('Salvo no aparelho');
  async function refresh() { setEntries(await listEntries()); const s = await backupState(); setPending((s.revision??0) > (s.backed_up_revision??0)); }
  function report(error: unknown) { const text = error instanceof Error ? error.message : 'Não foi possível concluir.'; if(Platform.OS==='web')setMessage(text); else Alert.alert('Financeiro',text); }
  useEffect(() => {
    refresh().catch(report);
    SecureStore.getItemAsync('backup-password').then(async saved => {
      if (!saved) return;
      setPassword(saved);
      try { await connectDrive(true); setDrive(true); } catch { setMessage('Salvo no aparelho · reconecte o Drive'); }
    }).catch(report);
  },[]);
  useEffect(() => {
    if (!drive || password.length < 12) return;
    const attempt = () => { setMessage('Enviando backup…'); backupToDrive(password).then(() => {setMessage('Backup concluído'); return refresh();}).catch(() => {setMessage('Salvo no aparelho · backup pendente');}); };
    attempt();
    const timer = setInterval(attempt,60000);
    const subscription = AppState.addEventListener('change',state => {if(state==='active') attempt();});
    return () => { clearInterval(timer); subscription.remove(); };
  },[drive,password]);
  async function save() {
    if (busy) return; setBusy(true);
    try {
      if (!/^\d+(?:[,.]\d{1,2})?$/.test(amount.trim())) throw new Error('Informe o valor, por exemplo 25,90.');
      const cents = Math.round(Number(amount.replace(',','.'))*100);
      await addEntry(description,-cents); setDescription(''); setAmount(''); await refresh(); setMessage('Salvo no aparelho · backup pendente');
      if (drive && password.length >= 12) { await backupToDrive(password); await refresh(); setMessage('Backup concluído'); }
    } catch(error) { report(error); } finally { setBusy(false); }
  }
  return <SafeAreaView style={[s.screen,Platform.OS==='web' && {width:'100%',maxWidth:460,alignSelf:'center'}]}><StatusBar style="dark"/><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
    <Text style={s.brand}>Financeiro</Text><Text style={s.subtitle}>Seu dinheiro, sempre com você</Text>
    <View style={s.hero}><Text style={s.muted}>{Platform.OS==='web'?'Prévia visual · dados de demonstração':'Base Android · desenvolvimento'}</Text><Text style={s.title}>Funciona offline</Text><Text style={s.muted}>{Platform.OS==='web'?'Teste o visual e adicione despesas fictícias. Drive e Pluggy estão desativados nesta prévia.':'Seus dados atuais ainda não foram importados.'}</Text></View>
    <View style={s.card}><Text style={s.heading}>Nova despesa</Text><TextInput accessibilityLabel="Descrição" style={s.input} placeholder="Descrição" value={description} onChangeText={setDescription}/><TextInput accessibilityLabel="Valor" style={s.input} placeholder="0,00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount}/><TouchableOpacity disabled={busy} onPress={save} style={s.button}><Text style={s.buttonText}>{busy?'Salvando…':'Salvar no aparelho'}</Text></TouchableOpacity></View>
    <View style={s.card}><Text style={s.heading}>Backup no seu Drive</Text><Text style={s.muted}>{pending ? message : 'Nenhuma alteração aguardando backup'}</Text><TextInput accessibilityLabel="Senha do backup" style={s.input} placeholder="Senha de backup · mínimo 12 caracteres" secureTextEntry value={password} onChangeText={setPassword}/><Text style={s.note}>Guarde essa senha. Ela será necessária para recuperar seus dados em outro celular.</Text><TouchableOpacity style={s.secondary} onPress={async()=>{try{if(password.length<12)throw new Error('Use uma senha com pelo menos 12 caracteres.');await connectDrive();await SecureStore.setItemAsync('backup-password',password);setDrive(true);await backupToDrive(password);await refresh();setMessage('Backup concluído');}catch(e){report(e);}}}><Text style={s.link}>Conectar Drive e fazer backup</Text></TouchableOpacity></View>
    <Text style={s.heading}>Lançamentos locais</Text>{entries.length===0?<Text style={s.muted}>Nenhum lançamento nesta instalação.</Text>:entries.map(e=><View style={s.row} key={e.id}><View style={{flex:1}}><Text style={s.description}>{e.description}</Text><Text style={s.note}>{e.purchase_date}</Text></View><Text style={s.value}>{money(e.amount_cents)}</Text></View>)}
  </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#f6f7fb'},content:{padding:24,paddingTop:40,gap:16},brand:{fontSize:29,fontWeight:'700',color:'#152342'},subtitle:{color:'#68758a',marginTop:-8},hero:{backgroundColor:'#eaf0ff',borderRadius:24,padding:24,gap:12},title:{fontSize:28,fontWeight:'700',color:'#2458ff'},card:{backgroundColor:'#fff',borderRadius:22,padding:20,gap:14},heading:{fontSize:19,fontWeight:'600',color:'#152342'},muted:{color:'#68758a',lineHeight:21},input:{borderWidth:1,borderColor:'#e1e6ef',borderRadius:14,padding:15,fontSize:16,color:'#152342'},button:{backgroundColor:'#2458ff',borderRadius:14,padding:16,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'600'},secondary:{paddingVertical:12},link:{color:'#2458ff',fontWeight:'600'},note:{fontSize:12,color:'#68758a',lineHeight:18},row:{backgroundColor:'#fff',borderRadius:16,padding:18,flexDirection:'row',gap:12,alignItems:'center'},description:{fontSize:16,color:'#152342'},value:{fontWeight:'600',color:'#ca4551'}});

