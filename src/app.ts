import { LitElement, html, query, css, internalProperty } from "lit-element";
import { ethers } from "ethers";
import { sharedStyles } from "./styles";

import { abi as abiUpr } from "./StaircaseBondingCurve.min.json";
import { abi as abiDai } from "./DAI.json";

import "@material/mwc-button";

const CONTRACT_ADDRESS = "0xEEB618686fb36F6B07b44b763B1A5C4267f0c5d7";
const DAI_ADDRESS = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";

export class App extends LitElement {
  @internalProperty()
  loading: boolean = true;

  @internalProperty()
  supply: ethers.BigNumber;

  @internalProperty()
  available1: ethers.BigNumber;

  @internalProperty()
  available2: ethers.BigNumber;

  @internalProperty()
  price: ethers.BigNumber;

  @internalProperty()
  amount: ethers.BigNumber;

  @internalProperty()
  account: string;

  @internalProperty()
  balanceOk: boolean = false;

  @internalProperty()
  approvedOk: boolean = false;

  @internalProperty()
  approving: boolean = false;

  @query("#amount-input")
  priceInput: any;

  provider: ethers.providers.JsonRpcProvider;
  signer: ethers.providers.JsonRpcSigner | undefined;
  token: ethers.Contract;
  dai: ethers.Contract;

  daiBalance: ethers.BigNumber;
  daiApproved: ethers.BigNumber;

  async firstUpdated() {
    this.provider = new ethers.providers.JsonRpcProvider(
      "https://xdai.poanetwork.dev"
    );
    this.signer = undefined;
    this.token = new ethers.Contract(CONTRACT_ADDRESS, abiUpr, this.provider);

    await this.refreshSupply();

    this.loading = false;
  }

  async refreshSupply() {
    this.supply = (await this.token.totalSupply()).sub(
      await this.token.initSupply()
    );
    const step1 = ethers.utils.parseUnits("10000000");
    const step2 = ethers.utils.parseUnits("20000000");

    this.available1 = this.supply.lte(step1)
      ? step1.sub(this.supply)
      : ethers.BigNumber.from("0");

    this.available2 = this.supply.lte(step2)
      ? this.supply.gt(step1)
        ? step2.sub(this.supply)
        : step2.sub(step1)
      : ethers.BigNumber.from("0");
  }

  async connect() {
    await window["ethereum"].enable();
    this.provider = new ethers.providers.Web3Provider(window["ethereum"]);
    this.signer = this.provider.getSigner();
    this.account = await this.signer.getAddress();
    this.token = new ethers.Contract(CONTRACT_ADDRESS, abiUpr, this.signer);
    this.dai = new ethers.Contract(DAI_ADDRESS, abiDai, this.signer);

    await this.refreshDai();
    this.requestUpdate();
  }

  async refreshDai() {
    if (this.signer === undefined) return;

    this.daiBalance = await this.dai.balanceOf(this.account);
    this.daiApproved = await this.dai.allowance(this.account, CONTRACT_ADDRESS);

    if (this.price !== undefined) {
      this.balanceOk = this.daiBalance.gte(this.price);
      this.approvedOk = this.daiApproved.gte(this.price);
    } else {
    }
  }

  async wrap() {
    const amount = this.price.sub(this.daiBalance);
    this.dai.deposit({ value: amount.toString() });
  }

  async approve() {
    this.approving = true;
    await this.dai.approve(CONTRACT_ADDRESS, this.price);
    this.approving = false;
    this.refreshDai();
  }

  async buy() {
    await this.token.mint(this.account, this.amount);
  }

  async updatePrice() {
    this.amount = ethers.utils.parseUnits(this.priceInput.value);
    const result = await this.token.mintCost(this.amount.toString());
    this.price = result[0];
    this.refreshDai();
  }

  render() {
    if (this.loading) {
      return html`loading...`;
    }

    const shouldConnect = this.signer === undefined;
    const shouldWrap =
      this.signer !== undefined && this.price !== undefined && !this.balanceOk;
    const shouldApprove =
      this.signer !== undefined &&
      this.price !== undefined &&
      this.balanceOk &&
      !this.approvedOk;
    const shouldBuy =
      this.signer !== undefined &&
      this.price !== undefined &&
      this.balanceOk &&
      this.approvedOk;

    return html`<div class="container">
      <h1>UPR Credits</h1>
      <table class="table">
        <tr>
          <td class="amount">1 DAI</td>
          <td class="arrow">-></td>
          <td class="amount">1 UPR</td>
          <td class="amount">infinite</td>
          <td class="available">available</td>
        </tr>
        <tr>
          <td class="amount">1 DAI</td>
          <td class="arrow">-></td>
          <td class="amount">10 UPR</td>
          <td class="amount">
            ${ethers.utils.commify(ethers.utils.formatEther(this.available2))}
          </td>
          <td class="available">available</td>
        </tr>
        <tr>
          <td class="amount">1 DAI</td>
          <td class="arrow">-></td>
          <td class="amount">100 UPR</td>
          <td class="amount">
            ${ethers.utils.commify(ethers.utils.formatEther(this.available1))}
          </td>
          <td class="available">available</td>
        </tr>
      </table>
      <div class="mg-top row">
        <input
          @input=${() => this.updatePrice()}
          id="amount-input"
          class="input"
          placeholder="amount"
          type="number"
        />
        <input
          class="input"
          disabled
          value=${ethers.utils.commify(
            this.price !== undefined
              ? ethers.utils.formatEther(this.price)
              : "0"
          )}
        />
      </div>
      <div class="mg-top column">
        <mwc-button ?disabled=${!shouldConnect} @click=${() => this.connect()}
          >${shouldConnect
            ? "connect"
            : `connected (${this.account.substr(0, 8)}...)`}
        </mwc-button>
        <mwc-button ?disabled=${!shouldWrap} @click=${() => this.wrap()}
          >wrap
          xDAI${shouldWrap
            ? ` (${ethers.utils.commify(
                ethers.utils.formatEther(this.price.sub(this.daiBalance))
              )})`
            : ""}
        </mwc-button>
        <mwc-button ?disabled=${!shouldApprove} @click=${() => this.approve()}
          >approve WXDAI
        </mwc-button>
        <mwc-button ?disabled=${!shouldBuy} @click=${() => this.buy()}
          >buy${shouldBuy
            ? ` (${ethers.utils.commify(
                ethers.utils.formatEther(this.amount)
              )})`
            : ""}
        </mwc-button>
      </div>
    </div>`;
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          height: 100vh;
          flex-direction: column;
          display: flex;
          justify-content: center;
          align-items: center;
          --mdc-theme-primary: #1564bf;
        }

        .container {
          position: relative;
          top: 0;
          flex: 1 1 auto;
          width: 100%;
          background-color: #fbfbfb;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .amount {
          text-align: right;
          width: 70px;
        }

        .arrow {
          text-align: center;
          width: 20px;
        }

        .mg-top {
          margin-top: 24px;
        }

        .input {
          padding: 3px 12px;
          margin-right: 6px;
          height: 30px;
        }
      `,
    ];
  }
}
