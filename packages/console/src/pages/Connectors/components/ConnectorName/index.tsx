import type { ConnectorResponse } from '@logto/schemas';
import { ConnectorType } from '@logto/schemas';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import Button from '@/components/Button';
import ConnectorLogo from '@/components/ConnectorLogo';
import ItemPreview from '@/components/ItemPreview';
import UnnamedTrans from '@/components/UnnamedTrans';
import {
  connectorPlaceholderIcon,
  connectorPlatformLabel,
  connectorTitlePlaceHolder,
} from '@/consts/connectors';
import { useTheme } from '@/hooks/use-theme';
import ConnectorPlatformIcon from '@/icons/ConnectorPlatformIcon';

import * as styles from './index.module.scss';

type Props = {
  type: ConnectorType;
  connectors: ConnectorResponse[];
  onClickSetup?: () => void;
};

const ConnectorName = ({ type, connectors, onClickSetup }: Props) => {
  const { t } = useTranslation(undefined, { keyPrefix: 'admin_console' });
  const connector = connectors[0];
  const theme = useTheme();

  if (!connector) {
    const PlaceholderIcon = connectorPlaceholderIcon[type];

    return (
      <ItemPreview
        title={
          <div className={styles.previewTitle}>
            <div>{t(connectorTitlePlaceHolder[type])}</div>
            {type !== ConnectorType.Social && (
              <Button title="general.set_up" onClick={onClickSetup} />
            )}
          </div>
        }
        icon={
          <div className={styles.logoContainer}>
            {PlaceholderIcon && <PlaceholderIcon className={styles.logo} />}
          </div>
        }
      />
    );
  }

  return (
    <Link to={`/connectors/${connector.id}`} className={styles.link}>
      <ItemPreview
        title={<UnnamedTrans resource={connector.name} />}
        subtitle={
          <>
            {type !== ConnectorType.Social && connector.id}
            {type === ConnectorType.Social && connectors.length > 1 && (
              <div className={styles.platforms}>
                {connectors.map(
                  ({ id, platform }) =>
                    platform && (
                      <div key={id} className={styles.platform}>
                        <ConnectorPlatformIcon platform={platform} />
                        {t(`${connectorPlatformLabel[platform]}`)}
                      </div>
                    )
                )}
              </div>
            )}
          </>
        }
        icon={
          <div className={styles.logoContainer}>
            <ConnectorLogo className={styles.logo} data={connector} />
          </div>
        }
      />
    </Link>
  );
};

export default ConnectorName;
