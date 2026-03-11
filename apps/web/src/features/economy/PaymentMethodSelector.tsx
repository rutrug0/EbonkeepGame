import { useTranslation } from "react-i18next";

export type PaymentMethod = "paypal" | "googlepay" | "applepay" | "card";

export type PaymentMethodSelection = {
  title: string;
  price: number;
  imagePath: string;
  subtitle?: string;
};

export interface PaymentMethodSelectorProps {
  selection: PaymentMethodSelection;
  onClose: () => void;
  onSelectMethod: (method: PaymentMethod) => void;
}

type PaymentMethodOption = {
  id: PaymentMethod;
  name: string;
  icon: string;
  accentClassName: string;
  enabled: boolean;
};

export function PaymentMethodSelector({ selection, onClose, onSelectMethod }: PaymentMethodSelectorProps) {
  const { t } = useTranslation("common");

  const methods: PaymentMethodOption[] = [
    {
      id: "paypal",
      name: t("shop.paymentMethods.paypal"),
      icon: "\u{1F4B3}",
      accentClassName: "isPayPal",
      enabled: true
    },
    {
      id: "googlepay",
      name: t("shop.paymentMethods.googlepay"),
      icon: "\u{1F535}",
      accentClassName: "isGooglePay",
      enabled: false
    },
    {
      id: "applepay",
      name: t("shop.paymentMethods.applepay"),
      icon: "\u{1F34E}",
      accentClassName: "isApplePay",
      enabled: false
    },
    {
      id: "card",
      name: t("shop.paymentMethods.card"),
      icon: "\u{1F4B0}",
      accentClassName: "isCard",
      enabled: false
    }
  ];

  return (
    <div className="imperialShopModalOverlay">
      <div className="paymentMethodModal">
        <div className="paymentMethodHeader">
          <div className="paymentMethodHeaderCopy">
            <h2>{t("shop.selectPaymentMethod")}</h2>
          </div>
          <button className="paymentMethodCloseButton" type="button" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className="paymentMethodBundlePanel">
          <div className="paymentMethodBundleSummary">
            <img className="paymentMethodBundleImage" src={selection.imagePath} alt="" aria-hidden="true" />
            <div className="paymentMethodBundleDetails">
              <div className="paymentMethodBundleAmount">{selection.title}</div>
              {selection.subtitle ? <div className="paymentMethodBundleSubtitle">{selection.subtitle}</div> : null}
            </div>
            <div className="paymentMethodBundlePrice">${selection.price.toFixed(2)}</div>
          </div>
        </div>

        <div className="paymentMethodGrid">
          {methods.map((method) => (
            <button
              key={method.id}
              type="button"
              className={`paymentMethodCard ${method.accentClassName}${!method.enabled ? " isDisabled" : ""}`}
              onClick={() => method.enabled && onSelectMethod(method.id)}
              disabled={!method.enabled}
            >
              <div className="paymentMethodCardTop">
                <div className="paymentMethodMark paymentMethodIcon" aria-hidden="true">
                  {method.icon}
                </div>
                {!method.enabled ? <div className="paymentMethodBadge">{t("shop.comingSoon")}</div> : null}
              </div>
              <div className="paymentMethodCardBody">
                <div className="paymentMethodName">{method.name}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="paymentMethodFooter">
          <p>{t("shop.allPaymentsSecure")}</p>
        </div>
      </div>
    </div>
  );
}
