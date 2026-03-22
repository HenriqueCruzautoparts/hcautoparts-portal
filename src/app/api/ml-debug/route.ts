import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const useToken = searchParams.get("token") === "true";
    
    const ML_APP_ID = "2515111313738929";
    const ML_SECRET_KEY = "wqeZZR38sTSUoiub67BbNXZInWhIe8x2";
    
    let token = null;
    let authStatus = "Não tentou obter token";
    let authError = null;

    if (useToken) {
        try {
            const authRes = await fetch('https://api.mercadolibre.com/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: ML_APP_ID,
                    client_secret: ML_SECRET_KEY
                })
            });
            const data = await authRes.json();
            if (data.access_token) {
                token = data.access_token;
                authStatus = "Token B2B obtido com sucesso!";
            } else {
                authStatus = "Falha ao obter token (campos faltando no JSON)";
                authError = data;
            }
        } catch (e: any) {
            authStatus = "Exceção ao obter Token";
            authError = e.message;
        }
    }

    const headers: any = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let apiStatus = 0;
    let apiStatusText = "";
    let apiError = null;
    let responseBody = null;

    try {
        const mlRes = await fetch('https://api.mercadolibre.com/sites/MLB/search?q=ipod&limit=1', {
            headers,
            signal: AbortSignal.timeout(5000)
        });
        apiStatus = mlRes.status;
        apiStatusText = mlRes.statusText;
        
        const rawText = await mlRes.text();
        try {
            responseBody = JSON.parse(rawText);
        } catch (e) {
            responseBody = rawText.substring(0, 500); // Se for HTML de bloqueio
        }
    } catch (e: any) {
        apiError = e.message;
    }

    return NextResponse.json({
        auth_step: { status: authStatus, error: authError, token_preview: token ? token.substring(0, 15) + '...' : null },
        search_step: { status: apiStatus, statusText: apiStatusText, headers_sent: Object.keys(headers), error: apiError },
        response_preview: responseBody
    });
}
