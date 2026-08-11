const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const SITE_URL = 'https://conferenciamotormax25-ship-it.github.io/MTX/';
const HORAS_LEMBRETE = new Set([9, 12, 15, 17]);
const CODIGOS_TOKEN_INVALIDO = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered'
]);

function carregarCredencial() {
    const segredo = process.env.FIREBASE_SERVICE_ACCOUNT;
    if(!segredo) {
        throw new Error('O segredo FIREBASE_SERVICE_ACCOUNT não foi configurado no GitHub.');
    }

    try {
        return JSON.parse(segredo);
    } catch (error) {
        throw new Error('O segredo FIREBASE_SERVICE_ACCOUNT não contém um JSON válido.');
    }
}

initializeApp({ credential: cert(carregarCredencial()) });
const db = getFirestore();

function horarioSaoPaulo() {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false
    }).formatToParts(new Date());

    const valor = (tipo) => partes.find((item) => item.type === tipo)?.value;
    const data = `${valor('year')}-${valor('month')}-${valor('day')}`;
    const hora = Number(valor('hour')) % 24;
    return { data, hora, chave: `${data}-${String(hora).padStart(2, '0')}` };
}

async function carregarDados() {
    const [inscricoes, pendentes] = await Promise.all([
        db.collection('push_subscriptions').where('ativo', '==', true).get(),
        db.collection('pedidos_mtx').where('situacao', '==', 'Não').get()
    ]);

    const referenciasPorToken = new Map();
    inscricoes.docs.forEach((item) => {
        const token = item.data().token;
        if(token) referenciasPorToken.set(token, item.ref);
    });

    return {
        tokens: [...referenciasPorToken.keys()],
        referenciasPorToken,
        pendentes: pendentes.docs
    };
}

async function removerInscricoesInvalidas(tokens, referenciasPorToken) {
    const referencias = tokens.map((token) => referenciasPorToken.get(token)).filter(Boolean);
    for(let inicio = 0; inicio < referencias.length; inicio += 500) {
        const lote = db.batch();
        referencias.slice(inicio, inicio + 500).forEach((referencia) => lote.delete(referencia));
        await lote.commit();
    }
}

async function enviarPush({ tokens, referenciasPorToken, title, body, tag }) {
    let enviados = 0;
    let falhas = 0;
    const invalidos = [];

    for(let inicio = 0; inicio < tokens.length; inicio += 500) {
        const loteTokens = tokens.slice(inicio, inicio + 500);
        const resposta = await getMessaging().sendEachForMulticast({
            tokens: loteTokens,
            data: { title, body, tag, url: SITE_URL },
            webpush: {
                headers: { Urgency: 'high' },
                fcmOptions: { link: SITE_URL }
            }
        });

        enviados += resposta.successCount;
        falhas += resposta.failureCount;
        resposta.responses.forEach((resultado, indice) => {
            if(!resultado.success && CODIGOS_TOKEN_INVALIDO.has(resultado.error?.code)) {
                invalidos.push(loteTokens[indice]);
            }
        });
    }

    await removerInscricoesInvalidas(invalidos, referenciasPorToken);
    console.log(`Push processado: ${enviados} enviado(s), ${falhas} falha(s).`);
    return enviados;
}

async function marcarPedidosComoAvisados(documentos) {
    for(let inicio = 0; inicio < documentos.length; inicio += 500) {
        const lote = db.batch();
        documentos.slice(inicio, inicio + 500).forEach((item) => {
            lote.update(item.ref, {
                push_github_enviado: true,
                push_github_enviado_em: FieldValue.serverTimestamp()
            });
        });
        await lote.commit();
    }
}

function resumoPedidos(documentos) {
    const numeros = documentos.slice(0, 3).map((item) => `#${item.data().num || item.id}`);
    const complemento = documentos.length > 3 ? ` e mais ${documentos.length - 3}` : '';
    return `${numeros.join(', ')}${complemento}`;
}

async function executar() {
    const { tokens, referenciasPorToken, pendentes } = await carregarDados();
    if(tokens.length === 0) {
        console.log('Nenhum computador ativou o push ainda.');
        return;
    }

    const forcarTeste = String(process.env.FORCAR_TESTE).toLowerCase() === 'true';
    if(forcarTeste) {
        await enviarPush({
            tokens,
            referenciasPorToken,
            title: '✅ Teste do Push MTX',
            body: `O push gratuito está funcionando. Pedidos pendentes agora: ${pendentes.length}.`,
            tag: 'mtx-teste-push'
        });
        return;
    }

    if(pendentes.length === 0) {
        console.log('Nenhum pedido pendente.');
        return;
    }

    const novos = pendentes.filter((item) => item.data().push_github_enviado !== true);
    const horario = horarioSaoPaulo();
    const controleRef = db.collection('push_controle').doc('lembrete_github');
    const controleSnap = await controleRef.get();
    const ultimaChave = controleSnap.exists ? controleSnap.data().ultimaChave : null;
    const deveLembrarAgora = HORAS_LEMBRETE.has(horario.hora) && ultimaChave !== horario.chave;
    let enviouNestaExecucao = false;

    if(novos.length > 0) {
        const enviados = await enviarPush({
            tokens,
            referenciasPorToken,
            title: `🔔 ${novos.length} ${novos.length === 1 ? 'novo pedido pendente' : 'novos pedidos pendentes'}`,
            body: `${resumoPedidos(novos)} ${novos.length === 1 ? 'precisa' : 'precisam'} dar entrada.`,
            tag: 'mtx-novos-pendentes'
        });

        if(enviados > 0) {
            await marcarPedidosComoAvisados(novos);
            enviouNestaExecucao = true;
        }
    }

    if(deveLembrarAgora) {
        if(!enviouNestaExecucao) {
            await enviarPush({
                tokens,
                referenciasPorToken,
                title: `🔔 ${pendentes.length} ${pendentes.length === 1 ? 'pedido pendente' : 'pedidos pendentes'}`,
                body: `${resumoPedidos(pendentes)} ${pendentes.length === 1 ? 'precisa' : 'precisam'} dar entrada.`,
                tag: 'mtx-lembrete-pendentes'
            });
        }

        await controleRef.set({
            ultimaChave: horario.chave,
            atualizadoEm: FieldValue.serverTimestamp()
        }, { merge: true });
    }

    if(!enviouNestaExecucao && !deveLembrarAgora) {
        console.log('Não há novos pedidos e não é horário de lembrete.');
    }
}

executar().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
