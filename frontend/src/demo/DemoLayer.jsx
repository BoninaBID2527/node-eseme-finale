import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import './demo.css';

// Livello della demo statica: mostra il popup che spiega cosa farebbe il backend e un piccolo indicatore "Demo".
export default function DemoLayer() {
  const [queue, setQueue] = useState([]);
  const [about, setAbout] = useState(false);

  useEffect(() => {
    const onPopup = (e) => setQueue((q) => [...q, e.detail]);
    window.addEventListener('demo:popup', onPopup);
    return () => window.removeEventListener('demo:popup', onPopup);
  }, []);

  const current = queue[0];
  const close = useCallback(() => {
    setQueue(([first, ...rest]) => {
      first?.resolve();
      return rest;
    });
  }, []);

  return (
    <>
      <button type="button" className="demo-pill" onClick={() => setAbout(true)} aria-label="Informazioni sulla demo">
        <Icon name="info" size={15} /> Demo
      </button>

      {about && (
        <Modal title="Questa è una demo" onClose={() => setAbout(false)} size="sm">
          <div className="demo-popup">
            <p>
              È l'interfaccia vera di BONTASK, pubblicata senza server: i dati sono quelli dimostrativi del seed e restano nel
              browser.
            </p>
            <p>
              Puoi navigare, filtrare e aprire progetti, task e chat. I pulsanti che scriverebbero sul server aprono una
              finestra che spiega cosa farebbe il backend, ma non salvano nulla.
            </p>
            <p className="demo-note">L'app completa (Node.js, Express, MongoDB, Socket.IO) si avvia in locale: istruzioni nel README del repository.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setAbout(false)} data-autofocus>
                Ho capito
              </button>
            </div>
          </div>
        </Modal>
      )}

      {current && (
        <Modal key={current.path + queue.length} title={current.info.title} onClose={close}>
          <div className="demo-popup">
            <p className="demo-endpoint">
              <Icon name="send" size={15} />
              <code>{current.info.endpoint}</code>
            </p>
            <p className="demo-who">
              <span>Chi può farlo</span> {current.info.who}
            </p>
            <h3 className="demo-title">Cosa fa il backend</h3>
            <ol className="demo-steps">
              {current.info.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {current.info.live && (
              <p className="demo-live">
                <Icon name="wifi" size={16} />
                <span>
                  <strong>Tempo reale:</strong> {current.info.live}
                </span>
              </p>
            )}
            <p className="demo-note">
              <Icon name="info" size={16} />
              <span>{current.info.after || 'Questa è una demo senza server: la modifica non viene salvata.'}</span>
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={close} data-autofocus>
                Ho capito
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
