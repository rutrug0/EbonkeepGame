import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IMPERIAL_BUNDLES, type ImperialBundle } from "@ebonkeep/shared";
import { PaymentMethodSelector, type PaymentMethod } from "./PaymentMethodSelector";

export interface ImperialShopProps {
  token: string | null;
  currentImperials: number;
}

export function ImperialShop({ token, currentImperials }: ImperialShopProps) {
  const { t } = useTranslation("common");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [successData, setSuccessData] = useState<{ imperials: number; newBalance: number } | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<ImperialBundle | null>(null);

  // Check if we're returning from PayPal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get("token");
    
    if (orderId) {
      // Clean up URL immediately
      window.history.replaceState({}, document.title, window.location.pathname);
      // Capture the payment
      handlePaymentReturn(orderId);
    }
  }, []);

  const handlePaymentReturn = async (orderId: string) => {
    if (!token) {
      setError("Authentication required");
      return;
    }

    setCapturing(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:4000/v1/payments/capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Payment capture failed" }));
        throw new Error(errorData.error || "Payment capture failed");
      }

      const result = await response.json();
      
      // Show success modal with updated balance
      setSuccessData({
        imperials: result.imperials,
        newBalance: currentImperials + result.imperials
      });
      setCapturing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment capture failed");
      setCapturing(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessData(null);
    // Reload to refresh balance
    window.location.reload();
  };

  const handleBundleClick = (bundle: ImperialBundle) => {
    if (!token) {
      setError(t("shop.errorAuthRequired"));
      return;
    }
    setSelectedBundle(bundle);
  };

  const handlePaymentMethodSelect = async (method: PaymentMethod) => {
    if (!selectedBundle) return;

    if (method !== "paypal") {
      setError(t("shop.errorPaymentMethod", { method }));
      setSelectedBundle(null);
      return;
    }

    // Close method selector and start PayPal flow
    setSelectedBundle(null);
    await handlePurchase(selectedBundle);
  };

  const handlePurchase = async (bundle: ImperialBundle) => {
    if (!token) {
      setError("You must be logged in to purchase Imperials");
      return;
    }

    setPurchasing(bundle.id);
    setError(null);

    try {
      const response = await fetch("http://localhost:4000/v1/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ bundleId: bundle.id })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Payment creation failed" }));
        throw new Error(errorData.error || "Payment creation failed");
      }

      const result = await response.json();
      
      // Redirect to PayPal for approval
      if (result.approvalUrl) {
        window.location.href = result.approvalUrl;
      } else {
        throw new Error("No approval URL received from payment processor");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate payment");
      setPurchasing(null);
    }
  };

  return (
    <>
      {/* Payment Method Selector Modal */}
      {selectedBundle && (
        <PaymentMethodSelector
          bundle={selectedBundle}
          onClose={() => setSelectedBundle(null)}
          onSelectMethod={handlePaymentMethodSelect}
        />
      )}

      {/* Loading Modal */}
      {capturing && (
        <div className="modal-overlay">
          <div className="loading-modal">
            <div className="spinner"></div>
            <h2>{t("shop.processingPayment")}</h2>
            <p>{t("shop.pleaseWait")}</p>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successData && (
        <div className="modal-overlay">
          <div className="success-modal">
            <div className="success-icon">✓</div>
            <h2>{t("shop.paymentSuccessful")}</h2>
            <div className="success-amount">
              +{successData.imperials.toLocaleString()} {t("shop.imperials")}
            </div>
            <div className="success-balance">
              {t("shop.newBalance")}: <span className="balance-highlight">{successData.newBalance.toLocaleString()}</span> {t("shop.imperials")}
            </div>
            <button className="success-button" onClick={handleSuccessClose}>
              {t("shop.awesome")}
            </button>
          </div>
        </div>
      )}

      {/* Shop Content - Now as a Page View */}
      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard">
            <h2>{t("shop.title")}</h2>
            <p>{t("shop.description")}</p>
          </article>

          <article className="contentCard">
            <div className="shop-balance-display">
              <span className="balance-label">{t("shop.currentBalance")}:</span>
              <span className="balance-value">{currentImperials.toLocaleString()} {t("shop.imperials")}</span>
            </div>
          </article>

          {error && (
            <article className="contentCard">
              <div className="shop-error">
                <strong>{t("app.errorPrefix")}:</strong> {error}
              </div>
            </article>
          )}

          <article className="contentCard">
            <h3 style={{ marginTop: 0 }}>{t("shop.availableBundles")}</h3>
            <div className="shop-bundles">
              {IMPERIAL_BUNDLES.map((bundle) => (
                <div key={bundle.id} className="bundle-card">
                  <div className="bundle-icon">💎</div>
                  <div className="bundle-name">{bundle.name}</div>
                  <div className="bundle-amount">{bundle.imperials.toLocaleString()} {t("shop.imperials")}</div>
                  <div className="bundle-price">
                    ${bundle.price.toFixed(2)} {bundle.currency}
                  </div>
                  <button
                    className="bundle-buy-button"
                    onClick={() => handleBundleClick(bundle)}
                    disabled={purchasing !== null || capturing}
                  >
                    {purchasing === bundle.id ? t("shop.processing") : t("shop.buyNow")}
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="contentCard">
            <p style={{ margin: 0, color: "var(--text-muted)", textAlign: "center" }}>
              {t("shop.allPurchasesFinal")}
            </p>
          </article>
        </section>
      </section>

      <style>{`
        /* Page view styles */
        .shop-balance-display {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background: rgba(233, 69, 96, 0.1);
          border-radius: 8px;
          font-size: 1.2em;
        }

        .balance-label {
          color: var(--text-muted);
        }

        .balance-value {
          color: #ffd700;
          font-weight: bold;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }

        .shop-error {
          padding: 15px;
          background: rgba(220, 53, 69, 0.2);
          border: 1px solid #dc3545;
          border-radius: 6px;
          color: #ff6b6b;
        }

        .shop-bundles {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .bundle-card {
          background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
          border: 2px solid #e94560;
          border-radius: 10px;
          padding: 25px;
          text-align: center;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .bundle-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
          border-color: #ffd700;
        }

        .bundle-icon {
          font-size: 3em;
          margin-bottom: 10px;
        }

        .bundle-name {
          font-size: 1.3em;
          font-weight: bold;
          color: #e94560;
        }

        .bundle-amount {
          font-size: 1.8em;
          font-weight: bold;
          color: #ffd700;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }

        .bundle-price {
          font-size: 1.4em;
          color: #fff;
          margin: 5px 0;
        }

        .bundle-buy-button {
          margin-top: auto;
          padding: 12px 24px;
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 1.1em;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .bundle-buy-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #ff6b6b 0%, #e94560 100%);
          transform: scale(1.05);
          box-shadow: 0 5px 20px rgba(233, 69, 96, 0.5);
        }

        .bundle-buy-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Loading Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 11000;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .loading-modal {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 2px solid #e94560;
          border-radius: 16px;
          padding: 50px 60px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(233, 69, 96, 0.5);
          animation: scaleIn 0.3s ease;
        }

        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .spinner {
          width: 60px;
          height: 60px;
          border: 5px solid rgba(233, 69, 96, 0.2);
          border-top-color: #e94560;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 30px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-modal h2 {
          color: #e94560;
          margin: 0 0 15px 0;
          font-size: 2em;
        }

        .loading-modal p {
          color: #ccc;
          margin: 0;
          font-size: 1.1em;
        }

        /* Success Modal */
        .success-modal {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 3px solid #28a745;
          border-radius: 20px;
          padding: 60px 80px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(40, 167, 69, 0.5);
          animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          max-width: 500px;
        }

        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }

        .success-icon {
          width: 100px;
          height: 100px;
          background: linear-gradient(135deg, #28a745 0%, #5fff5f 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 60px;
          color: white;
          margin: 0 auto 30px;
          box-shadow: 0 10px 30px rgba(40, 167, 69, 0.5);
          animation: checkmark 0.5s ease 0.3s both;
        }

        @keyframes checkmark {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        .success-modal h2 {
          color: #5fff5f;
          margin: 0 0 30px 0;
          font-size: 2.5em;
          text-shadow: 0 0 20px rgba(95, 255, 95, 0.5);
        }

        .success-amount {
          font-size: 3.5em;
          font-weight: bold;
          color: #ffd700;
          text-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
          margin: 20px 0;
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes glow {
          0%, 100% { text-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
          50% { text-shadow: 0 0 40px rgba(255, 215, 0, 1); }
        }

        .success-balance {
          font-size: 1.4em;
          color: #ccc;
          margin: 20px 0 40px 0;
        }

        .balance-highlight {
          color: #ffd700;
          font-weight: bold;
          font-size: 1.2em;
        }

        .success-button {
          padding: 18px 50px;
          background: linear-gradient(135deg, #28a745 0%, #5fff5f 100%);
          border: none;
          border-radius: 10px;
          color: white;
          font-size: 1.3em;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 2px;
          box-shadow: 0 5px 20px rgba(40, 167, 69, 0.4);
        }

        .success-button:hover {
          background: linear-gradient(135deg, #5fff5f 0%, #28a745 100%);
          transform: scale(1.05);
          box-shadow: 0 8px 30px rgba(40, 167, 69, 0.6);
        }
      `}</style>
    </>
  );
}
