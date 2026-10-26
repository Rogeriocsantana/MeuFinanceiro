/** Describe the operation without changing the idle button label. */
export function busyLabel(label:string):string {
 const verbs:Record<string,string>={Salvar:'Salvando',Registrar:'Registrando',Atualizar:'Atualizando',Sincronizar:'Sincronizando',Simular:'Simulando',Aplicar:'Aplicando',Confirmar:'Confirmando',Desfazer:'Desfazendo',Conectar:'Conectando',Testar:'Testando',Restaurar:'Restaurando',Criar:'Criando',Importar:'Importando',Excluir:'Excluindo',Remover:'Removendo',Vincular:'Vinculando',Conferir:'Conferindo'};
 return (verbs[label.trim().split(/\s+/)[0]||'']||'Processando')+'…';
}
