// /src/lib/admin-web/wallet.ts
type EthereumProvider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
    interface Window {
        ethereum?: EthereumProvider;
    }
}

function getBrowserWalletProvider(): EthereumProvider {
    if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("browser_wallet_not_available");
    }

    return window.ethereum;
}

export async function requestAdminWalletAddress(): Promise<string> {
    const provider = getBrowserWalletProvider();

    const accounts = await provider.request({
        method: "eth_requestAccounts",
    });

    if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || accounts[0].length === 0) {
        throw new Error("wallet_account_unavailable");
    }

    return accounts[0];
}

export async function signAdminChallengeMessage(params: {
    walletAddress: string;
    challenge: string;
}): Promise<string> {
    const provider = getBrowserWalletProvider();

    const signature = await provider.request({
        method: "personal_sign",
        params: [params.challenge, params.walletAddress],
    });

    if (typeof signature !== "string" || signature.length === 0) {
        throw new Error("wallet_signature_unavailable");
    }

    return signature;
}
