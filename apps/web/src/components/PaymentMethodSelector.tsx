import { useTranslation } from "react-i18next";
import type { ImperialBundle } from "@ebonkeep/shared";

export interface PaymentMethodSelectorProps {
  bundle: ImperialBundle;
  onClose: () => void;
  onSelectMethod: (method: PaymentMethod) => void;
}

export type PaymentMethod = "paypal" | "googlepay" | "applepay" | "card";

export function PaymentMethodSelector({ bundle, onClose, onSelectMethod }: PaymentMethodSelectorProps) {
  const { t } = useTranslation("common");
  
  const methods: Array<{ id: PaymentMethod; name: string; icon: string; enabled: boolean }> = [
    { id: "paypal", name: t("shop.paymentMethods.paypal"), icon: "💳", enabled: true },
    { id: "googlepay", name: t("shop.paymentMethods.googlepay"), icon: "🔵", enabled: false },
    { id: "applepay", name: t("shop.paymentMethods.applepay"), icon: "🍎", enabled: false },
    { id: "card", name: t("shop.paymentMethods.card"), icon: "💰", enabled: false }
  ];

  return (
    <div className="payment-method-overlay">
      <div className="payment-method-modal">
        <div className="payment-method-header">
          <h2>{t("shop.selectPaymentMethod")}</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="payment-method-bundle-info">
          <div className="bundle-summary">
            <div className="bundle-summary-icon">💎</div>
            <div className="bundle-summary-details">
              <div className="bundle-summary-name">{bundle.name}</div>
              <div className="bundle-summary-amount">{bundle.imperials.toLocaleString()} {t("shop.imperials")}</div>
            </div>
            <div className="bundle-summary-price">${bundle.price.toFixed(2)}</div>
          </div>
        </div>

        <div className="payment-methods-grid">
          {methods.map((method) => (
            <button
              key={method.id}
              className={`payment-method-card${!method.enabled ? " disabled" : ""}`}
              onClick={() => method.enabled && onSelectMethod(method.id)}
              disabled={!method.enabled}
            >
              <div className="payment-method-icon">{method.icon}</div>
              <div className="payment-method-name">{method.name}</div>
              {!method.enabled && <div className="payment-method-badge">{t("shop.comingSoon")}</div>}
            </button>
          ))}
        </div>

        <div className="payment-method-footer">
          <p>{t("shop.allPaymentsSecure")}</p>
        </div>
      </div>

      <style>{`
        .payment-method-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .payment-method-modal {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 2px solid #e94560;
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(233, 69, 96, 0.4);
          animation: scaleIn 0.3s ease;
        }

        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .payment-method-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 25px 30px;
          border-bottom: 2px solid #e94560;
        }

        .payment-method-header h2 {
          margin: 0;
          color: #e94560;
          font-size: 1.8em;
          text-shadow: 0 0 10px rgba(233, 69, 96, 0.5);
        }

        .close-button {
          background: none;
          border: none;
          color: #e94560;
          font-size: 28px;
          cursor: pointer;
          padding: 0;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .close-button:hover {
          background: rgba(233, 69, 96, 0.2);
          transform: scale(1.1);
        }

        .payment-method-bundle-info {
          padding: 25px 30px;
          background: rgba(233, 69, 96, 0.1);
        }

        .bundle-summary {
          display: flex;
          align-items: center;
          gap: 15px;
          background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
          border: 2px solid #e94560;
          border-radius: 12px;
          padding: 20px;
        }

        .bundle-summary-icon {
          font-size: 3em;
        }

        .bundle-summary-details {
          flex: 1;
        }

        .bundle-summary-name {
          font-size: 1.2em;
          font-weight: bold;
          color: #e94560;
          margin-bottom: 5px;
        }

        .bundle-summary-amount {
          font-size: 1.5em;
          font-weight: bold;
          color: #ffd700;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }

        .bundle-summary-price {
          font-size: 2em;
          font-weight: bold;
          color: #fff;
        }

        .payment-methods-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          padding: 30px;
        }

        .payment-method-card {
          background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
          border: 2px solid #e94560;
          border-radius: 12px;
          padding: 25px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          position: relative;
        }

        .payment-method-card:not(.disabled):hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
          border-color: #ffd700;
        }

        .payment-method-card.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          border-color: #666;
        }

        .payment-method-icon {
          font-size: 3em;
          margin-bottom: 5px;
        }

        .payment-method-name {
          font-size: 1.2em;
          font-weight: bold;
          color: #fff;
        }

        .payment-method-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background: #666;
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.7em;
          font-weight: bold;
          text-transform: uppercase;
        }

        .payment-method-footer {
          padding: 20px 30px;
          border-top: 2px solid #e94560;
          background: rgba(0, 0, 0, 0.3);
        }

        .payment-method-footer p {
          margin: 0;
          color: #999;
          font-size: 0.9em;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
