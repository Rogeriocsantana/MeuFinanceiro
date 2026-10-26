// Funcao legada isolada para regressao. Sem dados de usuarios.
function produtoControlesSalvar(input){pluggyOwner_();return prodSession_(()=>{
 const items=input&&input.items;if(!Array.isArray(items)||items.length>30)throw new Error('Configure até 30 controles.');
 const seen=new Set(),normalized=items.map(x=>{const c=prodRequired_('categories',x.categoryId,'Categoria');if(c.kind==='INCOME'||seen.has(c.id))throw new Error('Categoria duplicada ou incompatível.');seen.add(c.id);const limit=Number(x.limit);if(!Number.isFinite(limit)||limit<=0||limit>10000000)throw new Error('Informe um limite mensal válido.');return {categoryId:c.id,limit:Math.round(limit*100)/100};});
 for(const item of normalized){const category=prodRequired_('categories',item.categoryId,'Categoria'),parent=normalized.find(x=>x.categoryId===category.parent_id);if(parent&&Math.round(item.limit*100)>Math.round(parent.limit*100)){const group=prodRequired_('categories',parent.categoryId,'Categoria');throw new Error('O limite de '+category.name+' não pode ser maior que o de '+group.name+'.');}}
 PropertiesService.getScriptProperties().setProperty('FIN_SPENDING_CONTROLS',JSON.stringify(normalized));return {items:normalized};
});}


function pluggyOpenPayment_() {}
