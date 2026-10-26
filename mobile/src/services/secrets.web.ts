// A prévia não guarda tokens ou senhas no navegador.
export async function getItemAsync(_key: string): Promise<string | null> { return null; }
export async function setItemAsync(_key: string, _value: string): Promise<void> {
  throw new Error('Credenciais estão disponíveis somente no aplicativo Android.');
}
