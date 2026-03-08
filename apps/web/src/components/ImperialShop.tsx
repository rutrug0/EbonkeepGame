import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IMPERIAL_BUNDLES, type ImperialBundle } from "@ebonkeep/shared";
import {
  DAILY_PROVISION_CRATE_ICON_PATH,
  IMPERIAL_TRIBUTE_WAGON_ICON_PATH,
  IMPERIALS_ICON_PATH,
  QUARTERMASTERS_CHARTER_ICON_PATH
} from "../constants/uiAssets";
import { PaymentMethodSelector, type PaymentMethod } from "./PaymentMethodSelector";

export interface ImperialShopProps {
  token: string | null;
  currentImperials: number;
}

type ImperialOffer = {
  id: string;
  name: string;
  flavorText: string;
  price: number;
  iconPath: string;
};

const IMPERIAL_SHOP_OFFERS: readonly ImperialOffer[] = [
  {
    id: "imperial_tribute_wagon",
    name: "Imperial Tribute Wagon",
    flavorText: "A locked road-chest on iron wheels says the Empire prefers steady tribute over loud promises.",
    price: 200,
    iconPath: IMPERIAL_TRIBUTE_WAGON_ICON_PATH
  },
  {
    id: "quartermasters_charter",
    name: "Quartermaster's Charter",
    flavorText: "Privilege arrives rolled, sealed, and numbered long before mercy does.",
    price: 200,
    iconPath: QUARTERMASTERS_CHARTER_ICON_PATH
  },
  {
    id: "daily_provision_crate",
    name: "Daily Provision Crate",
    flavorText: "Some gifts arrive with trumpets. This one arrives ready for use.",
    price: 30,
    iconPath: DAILY_PROVISION_CRATE_ICON_PATH
  }
] as const;

function ShopOfferIcon({ src, alt }: { src: string; alt: string }) {
  const [iconSrc, setIconSrc] = useState(src);

  useEffect(() => {
    setIconSrc(src);
  }, [src]);

  return (
    <img
      className="imperialOfferIconImage"
      src={iconSrc}
      alt={alt}
      onError={() => {
        if (iconSrc !== IMPERIALS_ICON_PATH) {
          setIconSrc(IMPERIALS_ICON_PATH);
        }
      }}
    />
  );
}

export function ImperialShop({ token, currentImperials }: ImperialShopProps) {
  const { t } = useTranslation("common");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [successData, setSuccessData] = useState<{ imperials: number; newBalance: number } | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<ImperialBundle | null>(null);
  const baseImperialsPerDollar = IMPERIAL_BUNDLES[0].imperials / IMPERIAL_BUNDLES[0].price;

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get("token");

    if (orderId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      void handlePaymentReturn(orderId);
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Payment capture failed" }));
        throw new Error(errorData.error || "Payment capture failed");
      }

      const result = await response.json();

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
    if (!selectedBundle) {
      return;
    }

    if (method !== "paypal") {
      setError(t("shop.errorPaymentMethod", { method }));
      setSelectedBundle(null);
      return;
    }

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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ bundleId: bundle.id })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Payment creation failed" }));
        throw new Error(errorData.error || "Payment creation failed");
      }

      const result = await response.json();

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

  const handleOfferPurchase = (offer: ImperialOffer) => {
    setError(`${offer.name} is not purchasable yet.`);
  };

  return (
    <>
      {selectedBundle && (
        <PaymentMethodSelector
          bundle={selectedBundle}
          onClose={() => setSelectedBundle(null)}
          onSelectMethod={handlePaymentMethodSelect}
        />
      )}

      {capturing && (
        <div className="imperialShopModalOverlay">
          <div className="imperialShopStatusModal">
            <div className="imperialShopSpinner"></div>
            <h2>{t("shop.processingPayment")}</h2>
            <p>{t("shop.pleaseWait")}</p>
          </div>
        </div>
      )}

      {successData && (
        <div className="imperialShopModalOverlay">
          <div className="imperialShopStatusModal imperialShopStatusModalSuccess">
            <div className="imperialShopSuccessIcon" aria-hidden="true">
              <img src={IMPERIALS_ICON_PATH} alt="" />
            </div>
            <h2>{t("shop.paymentSuccessful")}</h2>
            <div className="imperialShopSuccessAmount">
              +{successData.imperials.toLocaleString()} {t("shop.imperials")}
            </div>
            <div className="imperialShopSuccessBalance">
              {t("shop.newBalance")}: <span className="imperialShopSuccessBalanceValue">{successData.newBalance.toLocaleString()}</span> {t("shop.imperials")}
            </div>
            <button className="imperialShopPrimaryButton" onClick={handleSuccessClose}>
              {t("shop.awesome")}
            </button>
          </div>
        </div>
      )}

      <section className="contentShell">
        <section className="contentStack">
          <article className="contentCard imperialShopHeaderCard">
            <div className="imperialShopHeader">
              <img className="imperialShopHeroIcon" src={IMPERIALS_ICON_PATH} alt="" aria-hidden="true" />
              <div className="imperialShopTitleGroup">
                <h2>{t("shop.title")}</h2>
              </div>
            </div>
          </article>

          {error && (
            <article className="contentCard">
              <div className="imperialShopError">
                <strong>{t("app.errorPrefix")}:</strong> {error}
              </div>
            </article>
          )}

          <article className="contentCard imperialShopBundlesCard">
            <div className="imperialShopSectionHeader">
              <h3>{t("shop.availableBundles")}</h3>
            </div>
            <div className="imperialBundleGrid">
              {IMPERIAL_BUNDLES.map((bundle) => (
                <div key={bundle.id} className="imperialBundleCard">
                  {(() => {
                    const bonus = Math.max(0, bundle.imperials - Math.round(bundle.price * baseImperialsPerDollar));
                    return (
                      <>
                  <div className="imperialBundleCardTop">
                    <div className="imperialBundleIconFrame" aria-hidden="true">
                      <img className="imperialShopIconImage" src={IMPERIALS_ICON_PATH} alt="" />
                    </div>
                    <div className="imperialBundleValueBlock">
                      <div className="imperialBundleValue">{bundle.imperials.toLocaleString()}</div>
                      {bonus > 0 ? <div className="imperialBundleBonusValue">+{bonus.toLocaleString()}</div> : null}
                      <div className="imperialBundleLabel">{t("shop.imperials")}</div>
                    </div>
                  </div>
                  <div className="imperialBundlePriceRow">
                    <span>{bundle.currency}</span>
                    <strong>${bundle.price.toFixed(2)}</strong>
                  </div>
                  <button
                    className="imperialShopPrimaryButton imperialBundleBuyButton"
                    onClick={() => handleBundleClick(bundle)}
                    disabled={purchasing !== null || capturing}
                  >
                    {purchasing === bundle.id ? t("shop.processing") : t("shop.buyNow")}
                  </button>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </article>

          <article className="contentCard imperialShopOffersCard">
            <div className="imperialShopSectionHeader">
              <h3>Special Offers</h3>
            </div>
            <div className="imperialOfferGrid">
              {IMPERIAL_SHOP_OFFERS.map((offer) => (
                <div key={offer.id} className="imperialOfferCard">
                  <div className="imperialOfferBody">
                    <div className="imperialOfferText">
                      <h4>{offer.name}</h4>
                    </div>
                    <div className="imperialOfferContent">
                      <div className="imperialOfferIconFrame" aria-hidden="true">
                        <ShopOfferIcon src={offer.iconPath} alt="" />
                      </div>
                      <div className="imperialOfferDetails">
                        <div className="imperialOfferFlavorText">
                          <p>{offer.flavorText}</p>
                        </div>
                        <div className="imperialOfferPriceRow">
                          <img className="imperialOfferPriceIcon" src={IMPERIALS_ICON_PATH} alt="" aria-hidden="true" />
                          <strong>{offer.price.toLocaleString()}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="imperialOfferFooter">
                      <button
                        className="imperialShopPrimaryButton imperialOfferBuyButton"
                        onClick={() => handleOfferPurchase(offer)}
                      >
                        {t("shop.buyNow")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="contentCard imperialShopLegalCard">
            <p>{t("shop.allPurchasesFinal")}</p>
          </article>
        </section>
      </section>
    </>
  );
}
