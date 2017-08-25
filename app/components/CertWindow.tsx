import * as events from "events";
import * as React from "react";
import { connect } from "react-redux";
import { get_Certificates, lang, LangApp } from "../module/global_app";
import {filteredCertificatesSelector} from "../selectors";
import BlockNotElements from "./BlockNotElements";
import CertificateInfo from "./CertificateInfo";
import CertificateList from "./CertificateList";
import PasswordDialog from "./PasswordDialog";
import ProgressBars from "./ProgressBars";
import { ToolBarWithSearch } from "./ToolBarWithSearch";

const DIALOG = window.electron.remote.dialog;

class CertWindow extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    this.state = ({
       activeCertificate: null,
    });
  }

  handleActiveCert = (certificate: any) => {
    this.setState({certificate});
  }

  certImport = (event: any) => {
    const { certificates } = this.props;

    const CERT_PATH = event[0].path;
    const certCount = certificates.length;

    if (!window.PKISTORE.importCert(CERT_PATH)) {
      this.p12Import(event);
    } else {
      if (certCount === certificates.length) {
        $(".toast-cert_imported").remove();
        Materialize.toast(lang.get_resource.Certificate.cert_imported, 2000, "toast-cert_imported");
      } else {
        $(".toast-cert_import_ok").remove();
        Materialize.toast(lang.get_resource.Certificate.cert_import_ok, 2000, ".toast-cert_import_ok");
      }
    }
  }

  p12Import = (event: any) => {
    const { certificates } = this.props;

    const P12_PATH = event[0].path;
    let p12: trusted.pki.Pkcs12;
    const certCount = certificates.length;

    try {
      p12 = trusted.pki.Pkcs12.load(P12_PATH);
    } catch (e) {
      p12 = undefined;
    }

    if (!p12) {
      $(".toast-cert_load_failed").remove();
      Materialize.toast(lang.get_resource.Certificate.cert_load_failed, 2000, "toast-cert_load_failed");
      return;
    }

    $("#get-password").openModal({
      complete() {
        if (!window.PKISTORE.importPkcs12(P12_PATH, this.state.pass_value)) {
          $(".toast-cert_import_failed").remove();
          Materialize.toast(lang.get_resource.Certificate.cert_import_failed, 2000, "toast-cert_import_failed");
        } else {
          if (certCount === certificates.length) {
            $(".toast-cert_imported").remove();
            Materialize.toast(lang.get_resource.Certificate.cert_imported, 2000, ".toast-cert_imported");
          } else {
            $(".toast-cert_import_ok").remove();
            Materialize.toast(lang.get_resource.Certificate.cert_import_ok, 2000, "toast-cert_import_ok");
          }

        }
      },
      dismissible: false,
    });
  }

  certAdd = () => {
    const CLICK_EVENT = document.createEvent("MouseEvents");

    CLICK_EVENT.initEvent("click", true, true);
    document.querySelector("#choose-cert").dispatchEvent(CLICK_EVENT);
  }

  importCertKey = (event: any) => {
    if (isEncryptedKey(event[0].path)) {
      $("#get-password").openModal({
        complete() {
          this.importCertKeyHelper(event[0].path, this.state.pass_value);
        },
        dismissible: false,
      });
    } else {
      this.importCertKeyHelper(event[0].path, "");
    }
  }

  importCertKeyHelper(path: string, pass: string) {
    $("#cert-key-import").val("");

    const { certificates } = this.props;
    const KEY_PATH = path;
    const CERTIFICATES = certificates;
    const RES = window.PKISTORE.importKey(KEY_PATH, pass);
    let key = 0;

    if (RES) {
      for (let i: number = 0; i < CERTIFICATES.length; i++) {
        if (CERTIFICATES[i].active) {
          CERTIFICATES[i].privateKey = true;
          key = i;
        }
      }

      $(".toast-key_import_ok").remove();
      Materialize.toast(lang.get_resource.Certificate.key_import_ok, 2000, "toast-key_import_ok");
    } else {
      $(".toast-key_import_failed").remove();
      Materialize.toast(lang.get_resource.Certificate.key_import_failed, 2000, "toast-key_import_failed");
    }
  }

  exportDirectory = () => {
    if (window.framework_NW) {
      const CLICK_EVENT = document.createEvent("MouseEvents");

      CLICK_EVENT.initEvent("click", true, true);
      document.querySelector("#choose-folder-export").dispatchEvent(CLICK_EVENT);
    } else {
      const FILE = DIALOG.showSaveDialog({
        defaultPath: lang.get_resource.Certificate.certificate + ".pfx",
        filters: [{ name: lang.get_resource.Certificate.certs, extensions: ["pfx"] }],
        title: lang.get_resource.Certificate.export_cert,
      });
      this.exportCert(FILE);
    }
  }

  exportCert = (file: string) => {
    let p12: trusted.pki.Pkcs12;

    if (file) {
      $("#get-password").openModal({
        complete() {
          const CERT_ITEM = this.state.activeCertificate;
          const CERT = window.PKISTORE.getPkiObject(CERT_ITEM);
          const KEY = window.PKISTORE.findKey(CERT_ITEM);

          if (!CERT || !KEY) {
            $(".toast-cert_export_failed").remove();
            Materialize.toast(lang.get_resource.Certificate.cert_export_failed, 2000, "toast-cert_export_failed");
          } else {
            p12 = new trusted.pki.Pkcs12();
            p12.create(CERT, KEY, null, this.state.pass_value, CERT_ITEM.subjectFriendlyName);
            p12.save(file);
            $(".toast-cert_export_ok").remove();
            Materialize.toast(lang.get_resource.Certificate.cert_export_ok, 2000, "toast-cert_export_ok");
          }
        },
        dismissible: false,
      });
    } else {
      $(".toast-cert_export_cancel").remove();
      Materialize.toast(lang.get_resource.Certificate.cert_export_cancel, 2000, "toast-cert_export_cancel");
    }
  }

  render() {
    const { certificates, isLoading } = this.props;
    const { certificate } = this.state;

    if (isLoading) {
      return  <ProgressBars />;
    }

    const CURRENT = certificate ? "not-active" : "active";
    let cert: any = null;
    let title: any = null;

    if (certificate) {
      cert = <CertificateInfo certificate={certificate} />;
      title = <div className="cert-title-main">
        <div className="collection-title cert-title">{certificate.subjectFriendlyName}</div>
        <div className="collection-info cert-info cert-title">{certificate.issuerFriendlyName}</div>
      </div>;
    } else {
      cert = "";
      title = <span>{lang.get_resource.Certificate.cert_info}</span>;
    }

    const NAME = certificates.length < 1 ? "active" : "not-active";
    const VIEW = certificates.length < 1 ? "not-active" : "";
    const DISABLED = certificate ? "" : "disabled";

    return (
      <div className="main">
        <div className="content">
          <div className="col s6 m6 l6 content-item-height" style={{ paddingRight: 0 }}>
            <div className="cert-content-item">
              <div className="content-wrapper z-depth-1">
                <ToolBarWithSearch operation="certificate" disable="" import={
                  (event: any) => {
                    this.certImport(event.target.files);
                  }
                } />
                <div className="add-certs">
                  <div className="add-certs-item">
                    <div className={"add-cert-collection collection " + VIEW}>
                      <input type="file" className="input-file" id="cert-key-import" onChange={
                        (event: any) => {
                          this.importCertKey(event.target.files);
                        }
                      } />
                      <CertificateList activeCert = {this.handleActiveCert} operation = "certificate"/>
                    </div>
                    <BlockNotElements name={NAME} title={lang.get_resource.Certificate.cert_not_found} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col s6 m6 l6 content-item-height">
            <div className="cert-content-item-height">
              <div className="content-wrapper z-depth-1">
                <nav className="app-bar-cert">
                  <ul className="app-bar-items">
                    <li className="cert-bar-text">
                      {title}
                      <input type="file" ref={(direct) => direct &&
                        direct.setAttribute("nwsaveas", lang.get_resource.Certificate.certificate + ".pfx")}
                        accept=".pfx" value="" id="choose-folder-export"
                        onChange={(event: any) => {
                          this.exportCert(event.target.value);
                        }} />
                    </li>
                    <li className="right">
                      <a className={"nav-small-btn waves-effect waves-light " + DISABLED} data-activates="dropdown-btn-for-cert">
                        <i className="nav-small-icon material-icons cert-settings">more_vert</i>
                      </a>
                      <ul id="dropdown-btn-for-cert" className="dropdown-content">
                        <li><a onClick={this.exportDirectory}>{lang.get_resource.Certificate.cert_export}</a></li>
                      </ul>
                    </li>
                  </ul>
                </nav>
                <div className="add-certs">
                  <div className="add-certs-item">
                    {cert}
                    <BlockNotElements name={CURRENT} title={lang.get_resource.Certificate.cert_not_select} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <PasswordDialog />
      </div>
    );
  }
}

export default connect((state) => {
  return {
    certificates: filteredCertificatesSelector(state),
    isLoading: state.certificates.loading,
  };
})(CertWindow);