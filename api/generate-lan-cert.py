from pathlib import Path
import json, ipaddress, os, hashlib
from datetime import datetime, timezone, timedelta
from cryptography import x509
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import hashes, serialization

ip=ipaddress.IPv4Address('192.168.2.106')
if not ip.is_private:
    raise RuntimeError('Acesso LAN deve usar apenas IPv4 privado.')
dest=Path(r'C:\Jogos\EIXO\server-data\tls')
dest.mkdir(parents=True,exist_ok=True)
if any(dest.glob('*.pem')) or (dest/'eixo-ca.cer').exists():
    raise RuntimeError('Certificado ja existe: renovacao deve ser planejada. Nada foi sobrescrito.')
now=datetime.now(timezone.utc)
ca_key=rsa.generate_private_key(public_exponent=65537,key_size=3072)
ca_subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'EIXO - Autoridade local de teste'),x509.NameAttribute(NameOID.ORGANIZATION_NAME,'EIXO Local Device')])
ca_cert=(x509.CertificateBuilder()
 .subject_name(ca_subject).issuer_name(ca_subject).public_key(ca_key.public_key())
 .serial_number(x509.random_serial_number())
 .not_valid_before(now-timedelta(days=1)).not_valid_after(now+timedelta(days=365))
 .add_extension(x509.BasicConstraints(ca=True,path_length=0),critical=True)
 .add_extension(x509.KeyUsage(digital_signature=False,content_commitment=False,key_encipherment=False,data_encipherment=False,key_agreement=False,key_cert_sign=True,crl_sign=True,encipher_only=False,decipher_only=False),critical=True)
 .add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()),critical=False)
 .sign(ca_key,hashes.SHA256()))
server_key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
server_subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,str(ip)),x509.NameAttribute(NameOID.ORGANIZATION_NAME,'EIXO Local App')])
server_cert=(x509.CertificateBuilder()
 .subject_name(server_subject).issuer_name(ca_cert.subject)
 .public_key(server_key.public_key()).serial_number(x509.random_serial_number())
 .not_valid_before(now-timedelta(hours=1)).not_valid_after(now+timedelta(days=364))
 .add_extension(x509.BasicConstraints(ca=False,path_length=None),critical=True)
 .add_extension(x509.KeyUsage(digital_signature=True,content_commitment=False,key_encipherment=True,data_encipherment=False,key_agreement=False,key_cert_sign=False,crl_sign=False,encipher_only=False,decipher_only=False),critical=True)
 .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),critical=False)
 .add_extension(x509.SubjectAlternativeName([x509.IPAddress(ip)]),critical=False)
 .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),critical=False)
 .sign(ca_key,hashes.SHA256()))
files={
  'server-key.pem':server_key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()),
  'server-cert.pem':server_cert.public_bytes(serialization.Encoding.PEM)+ca_cert.public_bytes(serialization.Encoding.PEM),
  'eixo-ca.cer':ca_cert.public_bytes(serialization.Encoding.DER),
}
for fname, data in files.items():
    p=dest/fname
    with p.open('xb') as f:f.write(data)
    try:os.chmod(p,0o600)
    except:pass
metadata={'lanIp':str(ip),'httpsPort':4174,'setupPort':4175,'caSha256':hashlib.sha256(ca_cert.public_bytes(serialization.Encoding.DER)).hexdigest().upper(),'validUntil':server_cert.not_valid_after_utc.isoformat()}
(dest/'lan.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print('EIXO_TLS_READY')
print('HTTPS https://'+str(ip)+':4174/')
print('CERT_SETUP http://'+str(ip)+':4175/')
print('CA_SHA256 '+metadata['caSha256'])
print('SERVER_EXPIRES '+metadata['validUntil'])
print('CA_PRIVATE_KEY_NOT_SAVED')
