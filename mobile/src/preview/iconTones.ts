export const iconTones={
 violet:['#72549d','#b9a1df'],
 blue:['#3966a6','#8aafe1'],
 teal:['#267678','#80c4c2'],
 green:['#36794d','#8bca9d'],
 amber:['#8d601e','#d7b172'],
 coral:['#9b5549','#d79b90'],
 slate:['#52657c','#a1b2c8'],
} as const;
type IconTone=keyof typeof iconTones;

const byIcon:Record<string,IconTone>={
 users:'violet',person:'violet',card:'blue',wallet:'teal',lock:'teal',
 income:'green',received:'green',check:'green',calendar:'amber',clock:'amber',
 food:'coral',cart:'coral',home:'blue',transfer:'slate',chart:'blue',file:'slate',
};

export function typeIconTone(icon:string,dark:boolean){
 return iconTones[byIcon[icon]??'slate'][dark?1:0];
}

export function categoryIconTone(name:string,dark:boolean){
 const category=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const tone:IconTone=/aliment|mercado|restaur|delivery|cafe|acougue/.test(category)?'coral':
  /moradia|casa|aluguel|transporte|combustivel/.test(category)?'blue':
  /receita|rendiment|salario/.test(category)?'green':
  /cofrinh|invest|reserva|saude/.test(category)?'teal':
  /pagamento|taxa|imposto/.test(category)?'amber':
  /compra|pessoal|lazer|educa|emprestim/.test(category)?'violet':'slate';
 return iconTones[tone][dark?1:0];
}
