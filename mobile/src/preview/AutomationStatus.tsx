import React,{useState,useEffect} from 'react';
import {Platform} from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import {loadDeviceEvent} from '../data/appPreferences';
import {Button,Card,u} from './ui';
import {Text} from './Typography';
import {sendTestNotification} from '../services/notifications';
export default function AutomationStatus({scope,notifications=false}:{scope:string;notifications?:boolean}){
 const [lines,setLines]=useState<string[]>([]),[error,setError]=useState('');
 const check=async()=>{if(Platform.OS==='web'){setLines(['O diagnóstico está disponível no aplicativo Android.']);return;}const [registered,last,permission,scheduled,notificationChannel]=await Promise.all([TaskManager.isTaskRegisteredAsync('financeiro-bank-refresh'),loadDeviceEvent(scope,'background-latest'),Notifications.getPermissionsAsync(),Notifications.getAllScheduledNotificationsAsync(),Platform.OS==='android'?Notifications.getNotificationChannelAsync('financeiro-lembretes'):Promise.resolve(null)]);const status:{[k:string]:string}={running:'iniciada',updated:'atualizada','not-due':'executada; intervalo ainda não vencido',failed:'falhou'};setLines([registered?'Segundo plano: tarefa registrada no Android.':'Segundo plano: nenhuma tarefa registrada.',last?'Última execução em segundo plano: '+new Date(last.at).toLocaleString('pt-BR')+' · '+(status[last.status]||last.status)+(last.error?' · '+last.error:''):'Ainda não há execução em segundo plano registrada nesta versão.','Notificações no Android: '+(permission.granted?'permitidas.':'não permitidas.'),'Canal de avisos: '+(notificationChannel?.importance===0?'bloqueado no Android.':notificationChannel?'configurado.':'ainda não criado.'),scheduled.filter(r=>r.identifier.startsWith('financeiro-')).length+' lembretes agendados.']);};
 const attempt=async(work:()=>Promise<unknown>)=>{setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Não foi possível verificar.');}};
 useEffect(()=>{void attempt(check);},[scope]);
 return <Card><Text style={u.h2}>Diagnóstico deste aparelho</Text>{lines.map(line=><Text key={line} style={u.small}>{line}</Text>)}{!!error&&<Text accessibilityRole="alert" style={u.small}>{error}</Text>}<Button secondary label="Atualizar diagnóstico" onPress={()=>attempt(check)}/>{notifications&&<Button secondary label="Enviar notificação de teste" onPress={()=>attempt(async()=>{await sendTestNotification();await check();})}/>}<Text style={u.small}>O Android pode adiar tarefas por bateria ou restrições do sistema. O intervalo não é um horário garantido. Forçar a parada do app impede a execução até abri-lo novamente.</Text></Card>;
}
